package domain

import "time"

// Product merepresentasikan entitas barang di katalog gudang StockFlow
type Product struct {
	ID             int        `json:"id"`
	SKU            string     `json:"sku"`
	Name           string     `json:"name"`
	Price          int        `json:"price"` // IDR integer: no float money!
	Stock          int        `json:"stock"`
	IsActive       bool       `json:"is_active"`
	CreatedAt      time.Time  `json:"created_at"`
	LastMovementAt *time.Time `json:"last_movement_at"` // Derived dari stock_movements (ISO string atau null)
}

// CreateProductRequest memuat payload untuk pendaftaran produk baru
type CreateProductRequest struct {
	SKU   string `json:"sku"`
	Name  string `json:"name"`
	Price int    `json:"price"`
}

// UpdateProductRequest memuat payload perubahan nama, harga, dan status aktif
type UpdateProductRequest struct {
	Name     string `json:"name"`
	Price    int    `json:"price"`
	IsActive *bool  `json:"is_active"`
}

// ProductListResponse membungkus data daftar produk beserta metadata pagination
type ProductListResponse struct {
	Data  []Product `json:"data"`
	Page  int       `json:"page"`
	Limit int       `json:"limit"`
	Total int       `json:"total"`
}

// ProductFilter memuat parameter kueri pencarian dan pagination
type ProductFilter struct {
	Search string
	Page   int
	Limit  int
}
