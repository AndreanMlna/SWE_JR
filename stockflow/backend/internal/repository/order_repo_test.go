package repository_test

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"os"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	_ "github.com/lib/pq"
	"stockflow/backend/internal/domain"
	"stockflow/backend/internal/repository"
)

func getTestDB(t *testing.T) *sql.DB {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgres://postgres:postgres@localhost:5432/stockflow?sslmode=disable"
	}

	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		t.Skipf("PostgreSQL tidak dapat dihubungi: %v (skipping repository integration test)", err)
		return nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	if err := db.PingContext(ctx); err != nil {
		t.Skipf("PostgreSQL ping gagal: %v (skipping repository integration test)", err)
		return nil
	}

	return db
}

// TestCreateOrder_HappyPath_Atomic membuktikan transaksi pesanan berhasil memotong stok,
// menghitung harga server secara independen, menulis sales_orders, sales_order_items, dan stock_movements.
func TestCreateOrder_HappyPath_Atomic(t *testing.T) {
	db := getTestDB(t)
	if db == nil {
		return
	}
	defer db.Close()

	ctx := context.Background()
	orderRepo := repository.NewPostgresOrderRepository(db)

	testSKU := fmt.Sprintf("TEST-HP-%d", time.Now().UnixNano())
	var productID int
	err := db.QueryRowContext(ctx, `
		INSERT INTO products (sku, name, price, stock, is_active)
		VALUES ($1, 'Produk Test Happy Path', 25000, 20, true)
		RETURNING id
	`, testSKU).Scan(&productID)
	if err != nil {
		t.Fatalf("Gagal setup data uji: %v", err)
	}

	// Buat pesanan sebanyak 5 pcs
	req := domain.CreateOrderRequest{
		Customer: "Customer Happy Path",
		Items: []domain.CreateOrderItemRequest{
			{SKU: testSKU, Qty: 5},
		},
	}

	order, err := orderRepo.CreateOrder(ctx, req)
	if err != nil {
		t.Fatalf("CreateOrder gagal: %v", err)
	}

	if order.Status != domain.OrderStatusCreated {
		t.Errorf("expected order status %s, got %s", domain.OrderStatusCreated, order.Status)
	}
	expectedTotal := 25000 * 5
	if order.Total != expectedTotal {
		t.Errorf("expected total %d, got %d", expectedTotal, order.Total)
	}

	// 1. Verifikasi sisa stok di DB = 15
	var remainingStock int
	err = db.QueryRowContext(ctx, `SELECT stock FROM products WHERE id = $1`, productID).Scan(&remainingStock)
	if err != nil || remainingStock != 15 {
		t.Errorf("expected remaining stock 15, got %d (err: %v)", remainingStock, err)
	}

	// 2. Verifikasi record stock_movements bertipe 'out' dengan qty 5
	var movementQty int
	var movementType string
	err = db.QueryRowContext(ctx, `
		SELECT type, qty FROM stock_movements 
		WHERE product_id = $1 ORDER BY id DESC LIMIT 1
	`, productID).Scan(&movementType, &movementQty)
	if err != nil || movementType != "out" || movementQty != 5 {
		t.Errorf("expected stock movement (type: out, qty: 5), got (%s, %d)", movementType, movementQty)
	}
}

// TestCreateOrder_InsufficientStock_Rollback menguji skenario stok tidak mencukupi
// pada order multi-item; membuktikan transaksi di-ROLLBACK secara utuh, error 409 dikembalikan,
// dan tidak ada baris parsial yang tertulis di database.
func TestCreateOrder_InsufficientStock_Rollback(t *testing.T) {
	db := getTestDB(t)
	if db == nil {
		return
	}
	defer db.Close()

	ctx := context.Background()
	orderRepo := repository.NewPostgresOrderRepository(db)

	skuA := fmt.Sprintf("TEST-ROLL-A-%d", time.Now().UnixNano())
	skuB := fmt.Sprintf("TEST-ROLL-B-%d", time.Now().UnixNano())

	var idA, idB int
	_ = db.QueryRowContext(ctx, `INSERT INTO products (sku, name, price, stock) VALUES ($1, 'Item A', 10000, 10) RETURNING id`, skuA).Scan(&idA)
	_ = db.QueryRowContext(ctx, `INSERT INTO products (sku, name, price, stock) VALUES ($1, 'Item B', 15000, 2) RETURNING id`, skuB).Scan(&idB)

	// Hitung total order awal sebelum transaksi
	var ordersCountBefore int
	_ = db.QueryRowContext(ctx, `SELECT COUNT(*) FROM sales_orders`).Scan(&ordersCountBefore)

	// Pesan Item A (cukup: minta 5 dari 10) dan Item B (overdraw: minta 5 padahal hanya ada 2)
	req := domain.CreateOrderRequest{
		Customer: "Customer Rollback Test",
		Items: []domain.CreateOrderItemRequest{
			{SKU: skuA, Qty: 5},
			{SKU: skuB, Qty: 5},
		},
	}

	_, err := orderRepo.CreateOrder(ctx, req)
	if err == nil {
		t.Fatalf("expected error 409 INSUFFICIENT_STOCK, got nil")
	}

	var appErr *domain.AppError
	if !errors.As(err, &appErr) {
		t.Fatalf("expected *domain.AppError, got %T: %v", err, err)
	}

	if appErr.StatusCode != 409 || appErr.Code != domain.ErrCodeInsufficientStock {
		t.Errorf("expected 409 INSUFFICIENT_STOCK, got status %d, code %s", appErr.StatusCode, appErr.Code)
	}
	if appErr.SKU != skuB {
		t.Errorf("expected failing SKU '%s', got '%s'", skuB, appErr.SKU)
	}
	if appErr.Available == nil || *appErr.Available != 2 {
		t.Errorf("expected available 2, got %v", appErr.Available)
	}

	// PEMBUKTIAN ROLLBACK: Stok Item A tidak boleh berkurang (harus tetap 10)
	var stockAAfter int
	_ = db.QueryRowContext(ctx, `SELECT stock FROM products WHERE id = $1`, idA).Scan(&stockAAfter)
	if stockAAfter != 10 {
		t.Errorf("ZERO-PARTIAL-WRITE VIOLATION: Item A stock decremented to %d after rollback", stockAAfter)
	}

	// PEMBUKTIAN ROLLBACK: Jumlah record sales_orders tidak boleh bertambah
	var ordersCountAfter int
	_ = db.QueryRowContext(ctx, `SELECT COUNT(*) FROM sales_orders`).Scan(&ordersCountAfter)
	if ordersCountAfter != ordersCountBefore {
		t.Errorf("ZERO-PARTIAL-WRITE VIOLATION: sales_orders count increased from %d to %d", ordersCountBefore, ordersCountAfter)
	}
}

// TestCreateOrder_Concurrency_RaceCondition membuktikan perlindungan anti-race condition di bawah beban paralel.
// 10 goroutine secara simultan berebut produk dengan sisa stok 5 (masing-masing meminta 1).
// Hasil yang terbukti benar: Tepat 5 goroutine berhasil (201), tepat 5 menerima 409 INSUFFICIENT_STOCK,
// dan stok akhir tepat 0 (tidak pernah negatif).
func TestCreateOrder_Concurrency_RaceCondition(t *testing.T) {
	db := getTestDB(t)
	if db == nil {
		return
	}
	defer db.Close()

	ctx := context.Background()
	orderRepo := repository.NewPostgresOrderRepository(db)

	testSKU := fmt.Sprintf("TEST-RACE-%d", time.Now().UnixNano())
	initialStock := 5
	totalRequests := 10

	var productID int
	err := db.QueryRowContext(ctx, `
		INSERT INTO products (sku, name, price, stock, is_active)
		VALUES ($1, 'Produk Uji Balap Konkurensi', 50000, $2, true)
		RETURNING id
	`, testSKU, initialStock).Scan(&productID)
	if err != nil {
		t.Fatalf("Gagal setup produk: %v", err)
	}

	var wg sync.WaitGroup
	var successCount int32
	var conflictCount int32
	var otherErrorCount int32

	// Barrier sync agar seluruh 10 goroutine mulai menembak pada milidetik yang persis sama
	startBarrier := make(chan struct{})

	for i := 0; i < totalRequests; i++ {
		wg.Add(1)
		go func(workerID int) {
			defer wg.Done()
			<-startBarrier // Tunggu sinyal mulai bersama

			req := domain.CreateOrderRequest{
				Customer: fmt.Sprintf("Parallel Worker #%d", workerID),
				Items: []domain.CreateOrderItemRequest{
					{SKU: testSKU, Qty: 1},
				},
			}

			_, err := orderRepo.CreateOrder(context.Background(), req)
			if err == nil {
				atomic.AddInt32(&successCount, 1)
				return
			}

			var appErr *domain.AppError
			if errors.As(err, &appErr) && appErr.StatusCode == 409 && appErr.Code == domain.ErrCodeInsufficientStock {
				atomic.AddInt32(&conflictCount, 1)
			} else {
				atomic.AddInt32(&otherErrorCount, 1)
				t.Logf("Unexpected error in worker %d: %v", workerID, err)
			}
		}(i)
	}

	// Lepaskan seluruh goroutine secara serentak
	close(startBarrier)
	wg.Wait()

	// Verifikasi asersi matematis
	if int(successCount) != initialStock {
		t.Errorf("CONCURRENCY INTEGRITY VIOLATION: expected %d successes, got %d", initialStock, successCount)
	}
	if int(conflictCount) != (totalRequests - initialStock) {
		t.Errorf("CONCURRENCY ERROR HANDLING VIOLATION: expected %d 409 conflicts, got %d", totalRequests-initialStock, conflictCount)
	}
	if otherErrorCount != 0 {
		t.Errorf("Unexpected errors during concurrent test: %d", otherErrorCount)
	}

	// Verifikasi stok akhir di basis data
	var finalStock int
	err = db.QueryRowContext(ctx, `SELECT stock FROM products WHERE id = $1`, productID).Scan(&finalStock)
	if err != nil {
		t.Fatalf("Gagal mengambil stok akhir: %v", err)
	}

	if finalStock != 0 {
		t.Errorf("ZERO-NEGATIVE GUARANTEE VIOLATION: expected final stock 0, got %d", finalStock)
	}
}

// TestCancelOrder_RestoreStock_Atomic menguji pembatalan pesanan yang mengembalikan stok
// dan mencegah double-cancellation (409 ORDER_ALREADY_CANCELLED).
func TestCancelOrder_RestoreStock_Atomic(t *testing.T) {
	db := getTestDB(t)
	if db == nil {
		return
	}
	defer db.Close()

	ctx := context.Background()
	orderRepo := repository.NewPostgresOrderRepository(db)

	testSKU := fmt.Sprintf("TEST-CANCEL-%d", time.Now().UnixNano())
	var productID int
	_ = db.QueryRowContext(ctx, `
		INSERT INTO products (sku, name, price, stock)
		VALUES ($1, 'Produk Uji Cancel', 30000, 10)
		RETURNING id
	`, testSKU).Scan(&productID)

	// Buat pesanan 4 pcs (stok jadi 6)
	order, err := orderRepo.CreateOrder(ctx, domain.CreateOrderRequest{
		Customer: "Customer Cancel Test",
		Items:    []domain.CreateOrderItemRequest{{SKU: testSKU, Qty: 4}},
	})
	if err != nil {
		t.Fatalf("Gagal create order: %v", err)
	}

	// Batalkan pesanan
	cancelledOrder, err := orderRepo.CancelOrder(ctx, order.ID)
	if err != nil {
		t.Fatalf("CancelOrder gagal: %v", err)
	}
	if cancelledOrder.Status != domain.OrderStatusCancelled {
		t.Errorf("expected status %s, got %s", domain.OrderStatusCancelled, cancelledOrder.Status)
	}
	if cancelledOrder.CancelledAt == nil {
		t.Errorf("expected cancelled_at timestamp to be set")
	}

	// Verifikasi stok kembali utuh ke 10
	var restoredStock int
	_ = db.QueryRowContext(ctx, `SELECT stock FROM products WHERE id = $1`, productID).Scan(&restoredStock)
	if restoredStock != 10 {
		t.Errorf("expected stock restored to 10, got %d", restoredStock)
	}

	// Verifikasi mutasi pemulihan stok tercatat
	var moveType string
	var moveQty int
	_ = db.QueryRowContext(ctx, `
		SELECT type, qty FROM stock_movements 
		WHERE product_id = $1 ORDER BY id DESC LIMIT 1
	`, productID).Scan(&moveType, &moveQty)
	if moveType != "in" || moveQty != 4 {
		t.Errorf("expected stock restoration movement (in, 4), got (%s, %d)", moveType, moveQty)
	}

	// Coba batalkan lagi: wajib ditolak 409 ORDER_ALREADY_CANCELLED
	_, err = orderRepo.CancelOrder(ctx, order.ID)
	if err == nil {
		t.Fatalf("expected error on double cancellation, got nil")
	}
	var appErr *domain.AppError
	if !errors.As(err, &appErr) || appErr.StatusCode != 409 || appErr.Code != "ORDER_ALREADY_CANCELLED" {
		t.Errorf("expected 409 ORDER_ALREADY_CANCELLED, got %v", err)
	}
}
