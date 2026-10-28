package domain

import "time"

// Status pesanan penjualan
const (
	OrderStatusCreated   = "CREATED"
	OrderStatusCancelled = "CANCELLED"
)

// SalesOrder merepresentasikan transaksi pesanan penjualan (Sales Order)
type SalesOrder struct {
	ID          int              `json:"id"`
	Customer    string           `json:"customer"`
	Status      string           `json:"status"` // 'CREATED' atau 'CANCELLED'
	Total       int              `json:"total"`  // Total kalkulasi server-side
	CreatedAt   time.Time        `json:"created_at"`
	CancelledAt *time.Time       `json:"cancelled_at,omitempty"`
	Items       []SalesOrderItem `json:"items"`
}

// SalesOrderItem merepresentasikan rincian produk dalam suatu order
type SalesOrderItem struct {
	ID        int    `json:"id"`
	OrderID   int    `json:"order_id"`
	SKU       string `json:"sku"`
	Qty       int    `json:"qty"`
	UnitPrice int    `json:"unit_price"` // Harga satuan saat transaksi diambil dari tabel products
}

// OrderItemRequest adalah payload rincian item yang dikirim oleh klien
type OrderItemRequest struct {
	SKU string `json:"sku"`
	Qty int    `json:"qty"`
}

// CreateOrderRequest adalah payload pembuatan order baru
type CreateOrderRequest struct {
	Customer string             `json:"customer"`
	Items    []OrderItemRequest `json:"items"`
}

// DailySalesReport memuat ringkasan rekapitulasi penjualan per hari (Bonus ERP feature)
type DailySalesReport struct {
	Date           string `json:"date"`
	TotalOrders    int    `json:"total_orders"`
	TotalRevenue   int    `json:"total_revenue"`
	TotalItemsSold int    `json:"total_items_sold"`
}

