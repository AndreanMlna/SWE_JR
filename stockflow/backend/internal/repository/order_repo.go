package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"stockflow/backend/internal/domain"
)

// OrderRepository mendefinisikan kontrak persistensi untuk pembuatan dan pembatalan pesanan penjualan
type OrderRepository interface {
	CreateOrder(ctx context.Context, req domain.CreateOrderRequest) (*domain.SalesOrder, error)
	GetOrderByID(ctx context.Context, id int) (*domain.SalesOrder, error)
	CancelOrder(ctx context.Context, id int) (*domain.SalesOrder, error)
}

type postgresOrderRepository struct {
	db *sql.DB
}

// NewPostgresOrderRepository menginisialisasi implementasi OrderRepository dengan PostgreSQL
func NewPostgresOrderRepository(db *sql.DB) OrderRepository {
	return &postgresOrderRepository{db: db}
}

func (r *postgresOrderRepository) CreateOrder(ctx context.Context, req domain.CreateOrderRequest) (*domain.SalesOrder, error) {
	// ==========================================
	// 1. Pre-flight Validation (Status 400)
	// ==========================================
	if strings.TrimSpace(req.Customer) == "" {
		return nil, domain.NewBadRequestError("INVALID_CUSTOMER", "Nama customer wajib diisi")
	}
	if len(req.Items) == 0 {
		return nil, domain.NewBadRequestError("EMPTY_ITEMS", "Pesanan wajib memiliki minimal 1 item produk")
	}

	// Deteksi SKU duplikat dan validasi qty > 0
	skuSeen := make(map[string]bool)
	uniqueSKUs := []string{}
	for _, item := range req.Items {
		trimmedSKU := strings.TrimSpace(item.SKU)
		if trimmedSKU == "" {
			return nil, domain.NewBadRequestError("EMPTY_SKU", "SKU produk tidak boleh kosong")
		}
		if item.Qty <= 0 {
			return nil, domain.NewBadRequestError("INVALID_QTY", fmt.Sprintf("Kuantitas untuk SKU '%s' harus lebih besar dari 0", trimmedSKU))
		}
		if skuSeen[trimmedSKU] {
			return nil, domain.NewBadRequestError("DUPLICATE_SKU", fmt.Sprintf("SKU '%s' terduplikasi dalam satu pesanan. Gabungkan kuantitas ke satu baris item.", trimmedSKU))
		}
		skuSeen[trimmedSKU] = true
		uniqueSKUs = append(uniqueSKUs, trimmedSKU)
	}

	// =========================================================================
	// 2. Deadlock Prevention: Urutkan SKU secara leksikografis (alphabetical)
	// Ketika 2 transaksi paralel mengunci baris yang sama, urutan kunci yang konsisten
	// mencegah circular wait (deadlock).
	// =========================================================================
	sortedSKUs := make([]string, len(uniqueSKUs))
	copy(sortedSKUs, uniqueSKUs)
	sort.Strings(sortedSKUs)

	// ==========================================
	// 3. Eksekusi Atomic Transaction (ACID)
	// ==========================================
	tx, err := r.db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelReadCommitted})
	if err != nil {
		return nil, domain.NewInternalError(fmt.Errorf("gagal memulai database transaction: %w", err))
	}
	defer tx.Rollback() // Rollback otomatis jika terjadi error atau panic

	// Kunci baris produk dengan SELECT ... FOR UPDATE terurut
	type lockedProduct struct {
		id       int
		sku      string
		price    int
		stock    int
		isActive bool
	}
	lockedProductsMap := make(map[string]*lockedProduct)

	for _, sku := range sortedSKUs {
		var lp lockedProduct
		err := tx.QueryRowContext(ctx, `
			SELECT id, sku, price, stock, is_active
			FROM products
			WHERE sku = $1
			FOR UPDATE
		`, sku).Scan(&lp.id, &lp.sku, &lp.price, &lp.stock, &lp.isActive)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return nil, domain.NewBadRequestError("UNKNOWN_SKU", fmt.Sprintf("SKU '%s' tidak ditemukan dalam katalog produk", sku))
			}
			return nil, domain.NewInternalError(fmt.Errorf("gagal mengunci produk SKU '%s': %w", sku, err))
		}
		if !lp.isActive {
			return nil, domain.NewBadRequestError("INACTIVE_PRODUCT", fmt.Sprintf("Produk dengan SKU '%s' saat ini tidak aktif dan tidak dapat dipesan", sku))
		}
		lockedProductsMap[sku] = &lp
	}

	// =========================================================================
	// 4. Verifikasi Stok Cukup & Hitung Server-Side Pricing (Status 409 jika overdraw)
	// =========================================================================
	serverComputedTotal := 0
	type itemToPersist struct {
		productID int
		sku       string
		qty       int
		unitPrice int
	}
	itemsToPersist := make([]itemToPersist, len(req.Items))

	for i, item := range req.Items {
		trimmedSKU := strings.TrimSpace(item.SKU)
		lp := lockedProductsMap[trimmedSKU]

		if item.Qty > lp.stock {
			// Batalkan transaksi secara utuh: no partial writes!
			return nil, domain.NewInsufficientStockError(
				fmt.Sprintf("Stok tidak mencukupi untuk SKU: %s", trimmedSKU),
				trimmedSKU,
				lp.stock,
			)
		}

		// Kedaulatan harga server: unit_price wajib dari database
		unitPrice := lp.price
		serverComputedTotal += unitPrice * item.Qty

		itemsToPersist[i] = itemToPersist{
			productID: lp.id,
			sku:       trimmedSKU,
			qty:       item.Qty,
			unitPrice: unitPrice,
		}
	}

	// =========================================================================
	// 5. Potong Stok & Buat Order + Items + Movements dalam Transaksi yang Sama
	// =========================================================================
	// 5a. Insert Header Sales Order
	var order domain.SalesOrder
	err = tx.QueryRowContext(ctx, `
		INSERT INTO sales_orders (customer, status, total, created_at)
		VALUES ($1, $2, $3, now())
		RETURNING id, customer, status, total, created_at
	`, strings.TrimSpace(req.Customer), domain.OrderStatusCreated, serverComputedTotal).Scan(
		&order.ID, &order.Customer, &order.Status, &order.Total, &order.CreatedAt,
	)
	if err != nil {
		return nil, domain.NewInternalError(fmt.Errorf("gagal membuat record sales order: %w", err))
	}

	orderItemsResult := []domain.SalesOrderItem{}

	for _, itp := range itemsToPersist {
		// 5b. Kurangi stok produk secara atomik
		_, err := tx.ExecContext(ctx, `
			UPDATE products
			SET stock = stock - $1
			WHERE id = $2 AND stock >= $1
		`, itp.qty, itp.productID)
		if err != nil {
			return nil, domain.NewInternalError(fmt.Errorf("gagal memperbarui pengurangan stok untuk SKU '%s': %w", itp.sku, err))
		}

		// 5c. Insert Detail Sales Order Item
		var orderItem domain.SalesOrderItem
		err = tx.QueryRowContext(ctx, `
			INSERT INTO sales_order_items (order_id, sku, qty, unit_price)
			VALUES ($1, $2, $3, $4)
			RETURNING id, order_id, sku, qty, unit_price
		`, order.ID, itp.sku, itp.qty, itp.unitPrice).Scan(
			&orderItem.ID, &orderItem.OrderID, &orderItem.SKU, &orderItem.Qty, &orderItem.UnitPrice,
		)
		if err != nil {
			return nil, domain.NewInternalError(fmt.Errorf("gagal menyimpan order item untuk SKU '%s': %w", itp.sku, err))
		}
		orderItemsResult = append(orderItemsResult, orderItem)

		// 5d. Catat stock movement audit trail
		movementNote := fmt.Sprintf("Sales Order #%d fulfillment", order.ID)
		_, err = tx.ExecContext(ctx, `
			INSERT INTO stock_movements (product_id, type, qty, note, created_at)
			VALUES ($1, 'out', $2, $3, now())
		`, itp.productID, itp.qty, movementNote)
		if err != nil {
			return nil, domain.NewInternalError(fmt.Errorf("gagal mencatat mutasi stok sales order untuk SKU '%s': %w", itp.sku, err))
		}
	}

	// 5e. Commit seluruh transaksi atomik
	if err := tx.Commit(); err != nil {
		return nil, domain.NewInternalError(fmt.Errorf("gagal commit transaksi sales order: %w", err))
	}

	order.Items = orderItemsResult
	return &order, nil
}

func (r *postgresOrderRepository) GetOrderByID(ctx context.Context, id int) (*domain.SalesOrder, error) {
	queryOrder := `
		SELECT id, customer, status, total, created_at, cancelled_at
		FROM sales_orders
		WHERE id = $1
	`
	var order domain.SalesOrder
	var cancelledAt sql.NullTime
	err := r.db.QueryRowContext(ctx, queryOrder, id).Scan(
		&order.ID, &order.Customer, &order.Status, &order.Total, &order.CreatedAt, &cancelledAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, domain.NewNotFoundError("ORDER_NOT_FOUND", fmt.Sprintf("Pesanan dengan ID %d tidak ditemukan", id))
		}
		return nil, domain.NewInternalError(fmt.Errorf("gagal mengambil data pesanan: %w", err))
	}
	if cancelledAt.Valid {
		order.CancelledAt = &cancelledAt.Time
	}

	// Ambil detail items
	queryItems := `
		SELECT id, order_id, sku, qty, unit_price
		FROM sales_order_items
		WHERE order_id = $1
		ORDER BY id ASC
	`
	rows, err := r.db.QueryContext(ctx, queryItems, id)
	if err != nil {
		return nil, domain.NewInternalError(fmt.Errorf("gagal mengambil item pesanan: %w", err))
	}
	defer rows.Close()

	items := []domain.SalesOrderItem{}
	for rows.Next() {
		var item domain.SalesOrderItem
		if err := rows.Scan(&item.ID, &item.OrderID, &item.SKU, &item.Qty, &item.UnitPrice); err != nil {
			return nil, domain.NewInternalError(fmt.Errorf("gagal membaca baris item pesanan: %w", err))
		}
		items = append(items, item)
	}
	order.Items = items

	return &order, nil
}

func (r *postgresOrderRepository) CancelOrder(ctx context.Context, id int) (*domain.SalesOrder, error) {
	// Mulai transaksi atomik untuk pembatalan order & pemulihan stok
	tx, err := r.db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelReadCommitted})
	if err != nil {
		return nil, domain.NewInternalError(fmt.Errorf("gagal memulai transaksi pembatalan: %w", err))
	}
	defer tx.Rollback()

	// 1. Kunci dan periksa status order saat ini
	var order domain.SalesOrder
	var cancelledAt sql.NullTime
	err = tx.QueryRowContext(ctx, `
		SELECT id, customer, status, total, created_at, cancelled_at
		FROM sales_orders
		WHERE id = $1
		FOR UPDATE
	`, id).Scan(&order.ID, &order.Customer, &order.Status, &order.Total, &order.CreatedAt, &cancelledAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, domain.NewNotFoundError("ORDER_NOT_FOUND", fmt.Sprintf("Pesanan dengan ID %d tidak ditemukan", id))
		}
		return nil, domain.NewInternalError(fmt.Errorf("gagal mengunci data pesanan: %w", err))
	}

	if order.Status == domain.OrderStatusCancelled {
		return nil, domain.NewConflictError("ORDER_ALREADY_CANCELLED", fmt.Sprintf("Pesanan #%d sudah dibatalkan sebelumnya", id))
	}

	// 2. Ambil seluruh item pesanan
	rows, err := tx.QueryContext(ctx, `
		SELECT id, order_id, sku, qty, unit_price
		FROM sales_order_items
		WHERE order_id = $1
		ORDER BY id ASC
	`, id)
	if err != nil {
		return nil, domain.NewInternalError(fmt.Errorf("gagal mengambil item pesanan untuk pemulihan stok: %w", err))
	}
	defer rows.Close()

	items := []domain.SalesOrderItem{}
	for rows.Next() {
		var item domain.SalesOrderItem
		if err := rows.Scan(&item.ID, &item.OrderID, &item.SKU, &item.Qty, &item.UnitPrice); err != nil {
			return nil, domain.NewInternalError(fmt.Errorf("gagal membaca item pesanan: %w", err))
		}
		items = append(items, item)
	}
	rows.Close()

	// 3. Pulihkan stok masing-masing item secara atomik dan catat stock movement 'in'
	for _, item := range items {
		// Update stok produk
		var productID int
		err := tx.QueryRowContext(ctx, `
			UPDATE products
			SET stock = stock + $1
			WHERE sku = $2
			RETURNING id
		`, item.Qty, item.SKU).Scan(&productID)
		if err != nil {
			return nil, domain.NewInternalError(fmt.Errorf("gagal memulihkan stok untuk SKU '%s': %w", item.SKU, err))
		}

		// Catat riwayat audit movement
		restoreNote := fmt.Sprintf("Sales Order #%d cancellation stock restoration", id)
		_, err = tx.ExecContext(ctx, `
			INSERT INTO stock_movements (product_id, type, qty, note, created_at)
			VALUES ($1, 'in', $2, $3, now())
		`, productID, item.Qty, restoreNote)
		if err != nil {
			return nil, domain.NewInternalError(fmt.Errorf("gagal mencatat mutasi pengembalian stok: %w", err))
		}
	}

	// 4. Update status order menjadi CANCELLED
	var nowCancelled time.Time
	err = tx.QueryRowContext(ctx, `
		UPDATE sales_orders
		SET status = $1, cancelled_at = now()
		WHERE id = $2
		RETURNING cancelled_at
	`, domain.OrderStatusCancelled, id).Scan(&nowCancelled)
	if err != nil {
		return nil, domain.NewInternalError(fmt.Errorf("gagal mengupdate status pesanan menjadi CANCELLED: %w", err))
	}

	// 5. Commit transaksi
	if err := tx.Commit(); err != nil {
		return nil, domain.NewInternalError(fmt.Errorf("gagal commit transaksi pembatalan pesanan: %w", err))
	}

	order.Status = domain.OrderStatusCancelled
	order.CancelledAt = &nowCancelled
	order.Items = items

	return &order, nil
}
