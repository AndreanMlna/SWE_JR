package domain

import "time"

// StockMovement merepresentasikan riwayat mutasi barang (audit trail)
type StockMovement struct {
	ID        int       `json:"id"`
	ProductID int       `json:"product_id"`
	Type      string    `json:"type"` // 'in' atau 'out'
	Qty       int       `json:"qty"`  // integer > 0
	Note      *string   `json:"note"`
	CreatedAt time.Time `json:"created_at"`
}

// AdjustStockRequest memuat payload penyesuaian stok manual (in/out)
type AdjustStockRequest struct {
	Type string `json:"type"`
	Qty  int    `json:"qty"`
	Note string `json:"note"`
}

// StockMovementsResponse membungkus list riwayat mutasi produk
type StockMovementsResponse struct {
	Data []StockMovement `json:"data"`
}
