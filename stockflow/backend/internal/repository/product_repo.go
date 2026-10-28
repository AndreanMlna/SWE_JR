package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"

	"stockflow/backend/internal/domain"
)

// ProductRepository mendefinisikan interface persistensi data untuk produk dan mutasi stok
type ProductRepository interface {
	GetProducts(ctx context.Context, filter domain.ProductFilter) ([]domain.Product, int, error)
	GetProductByID(ctx context.Context, id int) (*domain.Product, error)
	GetProductBySKU(ctx context.Context, sku string) (*domain.Product, error)
	CreateProduct(ctx context.Context, req domain.CreateProductRequest) (*domain.Product, error)
	UpdateProduct(ctx context.Context, id int, req domain.UpdateProductRequest) (*domain.Product, error)
	DeleteProduct(ctx context.Context, id int) error
	AdjustStock(ctx context.Context, productID int, req domain.AdjustStockRequest) (*domain.Product, error)
	GetMovements(ctx context.Context, productID int) ([]domain.StockMovement, error)
}

type postgresProductRepository struct {
	db *sql.DB
}

// NewPostgresProductRepository menginisialisasi implementasi ProductRepository berbasis PostgreSQL
func NewPostgresProductRepository(db *sql.DB) ProductRepository {
	return &postgresProductRepository{db: db}
}

func (r *postgresProductRepository) GetProducts(ctx context.Context, filter domain.ProductFilter) ([]domain.Product, int, error) {
	if filter.Page <= 0 {
		filter.Page = 1
	}
	if filter.Limit <= 0 {
		filter.Limit = 10
	}
	offset := (filter.Page - 1) * filter.Limit

	whereClauses := []string{"1=1"}
	args := []interface{}{}
	argIdx := 1

	if strings.TrimSpace(filter.Search) != "" {
		searchTerm := "%" + strings.TrimSpace(filter.Search) + "%"
		whereClauses = append(whereClauses, fmt.Sprintf("(p.sku ILIKE $%d OR p.name ILIKE $%d)", argIdx, argIdx))
		args = append(args, searchTerm)
		argIdx++
	}

	whereSQL := strings.Join(whereClauses, " AND ")

	// Hitung total data untuk pagination
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM products p WHERE %s", whereSQL)
	var total int
	err := r.db.QueryRowContext(ctx, countQuery, args...).Scan(&total)
	if err != nil {
		return nil, 0, domain.NewInternalError(fmt.Errorf("gagal menghitung total produk: %w", err))
	}

	// Query data dengan LEFT JOIN untuk derive last_movement_at secara atomik dan konsisten
	dataQuery := fmt.Sprintf(`
		SELECT 
			p.id, p.sku, p.name, p.price, p.stock, p.is_active, p.created_at,
			sm.last_movement_at
		FROM products p
		LEFT JOIN (
			SELECT product_id, MAX(created_at) AS last_movement_at
			FROM stock_movements
			GROUP BY product_id
		) sm ON sm.product_id = p.id
		WHERE %s
		ORDER BY p.id ASC
		LIMIT $%d OFFSET $%d
	`, whereSQL, argIdx, argIdx+1)

	queryArgs := append(args, filter.Limit, offset)
	rows, err := r.db.QueryContext(ctx, dataQuery, queryArgs...)
	if err != nil {
		return nil, 0, domain.NewInternalError(fmt.Errorf("gagal mengambil daftar produk: %w", err))
	}
	defer rows.Close()

	products := []domain.Product{}
	for rows.Next() {
		var p domain.Product
		var lastMovement sql.NullTime
		if err := rows.Scan(
			&p.ID, &p.SKU, &p.Name, &p.Price, &p.Stock, &p.IsActive, &p.CreatedAt,
			&lastMovement,
		); err != nil {
			return nil, 0, domain.NewInternalError(fmt.Errorf("gagal membaca baris produk: %w", err))
		}
		if lastMovement.Valid {
			p.LastMovementAt = &lastMovement.Time
		}
		products = append(products, p)
	}

	return products, total, nil
}

func (r *postgresProductRepository) GetProductByID(ctx context.Context, id int) (*domain.Product, error) {
	query := `
		SELECT 
			p.id, p.sku, p.name, p.price, p.stock, p.is_active, p.created_at,
			sm.last_movement_at
		FROM products p
		LEFT JOIN (
			SELECT product_id, MAX(created_at) AS last_movement_at
			FROM stock_movements
			GROUP BY product_id
		) sm ON sm.product_id = p.id
		WHERE p.id = $1
	`
	var p domain.Product
	var lastMovement sql.NullTime
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&p.ID, &p.SKU, &p.Name, &p.Price, &p.Stock, &p.IsActive, &p.CreatedAt,
		&lastMovement,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, domain.NewNotFoundError("PRODUCT_NOT_FOUND", fmt.Sprintf("Produk dengan ID %d tidak ditemukan", id))
		}
		return nil, domain.NewInternalError(err)
	}
	if lastMovement.Valid {
		p.LastMovementAt = &lastMovement.Time
	}
	return &p, nil
}

func (r *postgresProductRepository) GetProductBySKU(ctx context.Context, sku string) (*domain.Product, error) {
	query := `
		SELECT 
			p.id, p.sku, p.name, p.price, p.stock, p.is_active, p.created_at,
			sm.last_movement_at
		FROM products p
		LEFT JOIN (
			SELECT product_id, MAX(created_at) AS last_movement_at
			FROM stock_movements
			GROUP BY product_id
		) sm ON sm.product_id = p.id
		WHERE p.sku = $1
	`
	var p domain.Product
	var lastMovement sql.NullTime
	err := r.db.QueryRowContext(ctx, query, sku).Scan(
		&p.ID, &p.SKU, &p.Name, &p.Price, &p.Stock, &p.IsActive, &p.CreatedAt,
		&lastMovement,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, domain.NewNotFoundError("PRODUCT_NOT_FOUND", fmt.Sprintf("Produk dengan SKU %s tidak ditemukan", sku))
		}
		return nil, domain.NewInternalError(err)
	}
	if lastMovement.Valid {
		p.LastMovementAt = &lastMovement.Time
	}
	return &p, nil
}

func (r *postgresProductRepository) CreateProduct(ctx context.Context, req domain.CreateProductRequest) (*domain.Product, error) {
	query := `
		INSERT INTO products (sku, name, price, stock, is_active, created_at)
		VALUES ($1, $2, $3, 0, TRUE, now())
		RETURNING id, sku, name, price, stock, is_active, created_at
	`
	var p domain.Product
	err := r.db.QueryRowContext(ctx, query, req.SKU, req.Name, req.Price).Scan(
		&p.ID, &p.SKU, &p.Name, &p.Price, &p.Stock, &p.IsActive, &p.CreatedAt,
	)
	if err != nil {
		if strings.Contains(err.Error(), "duplicate key value") || strings.Contains(err.Error(), "products_sku_key") {
			return nil, domain.NewConflictError("SKU_EXISTS", fmt.Sprintf("SKU '%s' sudah terdaftar dalam sistem", req.SKU))
		}
		return nil, domain.NewInternalError(fmt.Errorf("gagal membuat produk baru: %w", err))
	}
	return &p, nil
}

func (r *postgresProductRepository) UpdateProduct(ctx context.Context, id int, req domain.UpdateProductRequest) (*domain.Product, error) {
	// Pastikan produk ada terlebih dahulu
	existing, err := r.GetProductByID(ctx, id)
	if err != nil {
		return nil, err
	}

	name := existing.Name
	if strings.TrimSpace(req.Name) != "" {
		name = strings.TrimSpace(req.Name)
	}

	price := existing.Price
	if req.Price >= 0 {
		price = req.Price
	}

	isActive := existing.IsActive
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	query := `
		UPDATE products
		SET name = $1, price = $2, is_active = $3
		WHERE id = $4
		RETURNING id, sku, name, price, stock, is_active, created_at
	`
	var p domain.Product
	err = r.db.QueryRowContext(ctx, query, name, price, isActive, id).Scan(
		&p.ID, &p.SKU, &p.Name, &p.Price, &p.Stock, &p.IsActive, &p.CreatedAt,
	)
	if err != nil {
		return nil, domain.NewInternalError(fmt.Errorf("gagal memperbarui produk: %w", err))
	}
	p.LastMovementAt = existing.LastMovementAt
	return &p, nil
}

func (r *postgresProductRepository) DeleteProduct(ctx context.Context, id int) error {
	// 1. Cek apakah produk memiliki riwayat mutasi stok
	var movementCount int
	err := r.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM stock_movements WHERE product_id = $1", id).Scan(&movementCount)
	if err != nil {
		return domain.NewInternalError(fmt.Errorf("gagal memeriksa riwayat mutasi produk: %w", err))
	}
	if movementCount > 0 {
		return domain.NewConflictError("PRODUCT_HAS_HISTORY", "Produk tidak dapat dihapus karena memiliki riwayat pergerakan stok (audit trail dilindungi)")
	}

	// 2. Jika tidak ada riwayat, lakukan penghapusan
	res, err := r.db.ExecContext(ctx, "DELETE FROM products WHERE id = $1", id)
	if err != nil {
		return domain.NewInternalError(fmt.Errorf("gagal menghapus produk: %w", err))
	}

	rowsAffected, err := res.RowsAffected()
	if err != nil {
		return domain.NewInternalError(err)
	}
	if rowsAffected == 0 {
		return domain.NewNotFoundError("PRODUCT_NOT_FOUND", fmt.Sprintf("Produk dengan ID %d tidak ditemukan", id))
	}

	return nil
}

func (r *postgresProductRepository) AdjustStock(ctx context.Context, productID int, req domain.AdjustStockRequest) (*domain.Product, error) {
	// Eksekusi penyesuaian stok dan pencatatan audit movement dalam satu transaksi atomik
	tx, err := r.db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelReadCommitted})
	if err != nil {
		return nil, domain.NewInternalError(fmt.Errorf("gagal memulai database transaction: %w", err))
	}
	defer tx.Rollback()

	// 1. Pessimistic Row Locking untuk menghindari race condition
	var p domain.Product
	err = tx.QueryRowContext(ctx, `
		SELECT id, sku, name, price, stock, is_active, created_at
		FROM products
		WHERE id = $1
		FOR UPDATE
	`, productID).Scan(&p.ID, &p.SKU, &p.Name, &p.Price, &p.Stock, &p.IsActive, &p.CreatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, domain.NewNotFoundError("PRODUCT_NOT_FOUND", fmt.Sprintf("Produk dengan ID %d tidak ditemukan", productID))
		}
		return nil, domain.NewInternalError(fmt.Errorf("gagal mengunci baris produk: %w", err))
	}

	// 2. Evaluasi ketersediaan stok jika tipe 'out'
	newStock := p.Stock
	if req.Type == "out" {
		if req.Qty > p.Stock {
			return nil, domain.NewInsufficientStockError(
				fmt.Sprintf("Stok tidak mencukupi untuk penyesuaian keluar SKU '%s'", p.SKU),
				p.SKU,
				p.Stock,
			)
		}
		newStock -= req.Qty
	} else if req.Type == "in" {
		newStock += req.Qty
	} else {
		return nil, domain.NewBadRequestError("INVALID_TYPE", "Tipe mutasi hanya boleh 'in' atau 'out'")
	}

	// 3. Update stok produk
	_, err = tx.ExecContext(ctx, "UPDATE products SET stock = $1 WHERE id = $2", newStock, productID)
	if err != nil {
		return nil, domain.NewInternalError(fmt.Errorf("gagal memperbarui stok produk: %w", err))
	}

	// 4. Catat riwayat audit movement
	var noteParam *string
	if strings.TrimSpace(req.Note) != "" {
		trimmedNote := strings.TrimSpace(req.Note)
		noteParam = &trimmedNote
	}

	var movementCreatedAt time.Time
	err = tx.QueryRowContext(ctx, `
		INSERT INTO stock_movements (product_id, type, qty, note, created_at)
		VALUES ($1, $2, $3, $4, now())
		RETURNING created_at
	`, productID, req.Type, req.Qty, noteParam).Scan(&movementCreatedAt)
	if err != nil {
		return nil, domain.NewInternalError(fmt.Errorf("gagal mencatat riwayat mutasi stok: %w", err))
	}

	// 5. Commit transaksi atomik
	if err := tx.Commit(); err != nil {
		return nil, domain.NewInternalError(fmt.Errorf("gagal commit transaksi mutasi stok: %w", err))
	}

	p.Stock = newStock
	p.LastMovementAt = &movementCreatedAt
	return &p, nil
}

func (r *postgresProductRepository) GetMovements(ctx context.Context, productID int) ([]domain.StockMovement, error) {
	// Pastikan produk ada
	_, err := r.GetProductByID(ctx, productID)
	if err != nil {
		return nil, err
	}

	query := `
		SELECT id, product_id, type, qty, note, created_at
		FROM stock_movements
		WHERE product_id = $1
		ORDER BY created_at DESC, id DESC
	`
	rows, err := r.db.QueryContext(ctx, query, productID)
	if err != nil {
		return nil, domain.NewInternalError(fmt.Errorf("gagal mengambil riwayat mutasi: %w", err))
	}
	defer rows.Close()

	movements := []domain.StockMovement{}
	for rows.Next() {
		var m domain.StockMovement
		var note sql.NullString
		if err := rows.Scan(&m.ID, &m.ProductID, &m.Type, &m.Qty, &note, &m.CreatedAt); err != nil {
			return nil, domain.NewInternalError(fmt.Errorf("gagal membaca baris mutasi: %w", err))
		}
		if note.Valid {
			m.Note = &note.String
		}
		movements = append(movements, m)
	}

	return movements, nil
}
