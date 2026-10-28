package handler_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"stockflow/backend/internal/domain"
	"stockflow/backend/internal/handler"
)

type mockProductService struct {
	getProductsFunc    func(ctx context.Context, filter domain.ProductFilter) (*domain.ProductListResponse, error)
	getProductByIDFunc func(ctx context.Context, id int) (*domain.Product, error)
	createProductFunc  func(ctx context.Context, req domain.CreateProductRequest) (*domain.Product, error)
	updateProductFunc  func(ctx context.Context, id int, req domain.UpdateProductRequest) (*domain.Product, error)
	deleteProductFunc  func(ctx context.Context, id int) error
	adjustStockFunc    func(ctx context.Context, productID int, req domain.AdjustStockRequest) (*domain.Product, error)
	getMovementsFunc   func(ctx context.Context, productID int) (*domain.StockMovementsResponse, error)
}

func (m *mockProductService) GetProducts(ctx context.Context, filter domain.ProductFilter) (*domain.ProductListResponse, error) {
	if m.getProductsFunc != nil {
		return m.getProductsFunc(ctx, filter)
	}
	return &domain.ProductListResponse{}, nil
}

func (m *mockProductService) GetProductByID(ctx context.Context, id int) (*domain.Product, error) {
	if m.getProductByIDFunc != nil {
		return m.getProductByIDFunc(ctx, id)
	}
	return nil, nil
}

func (m *mockProductService) CreateProduct(ctx context.Context, req domain.CreateProductRequest) (*domain.Product, error) {
	if m.createProductFunc != nil {
		return m.createProductFunc(ctx, req)
	}
	return nil, nil
}

func (m *mockProductService) UpdateProduct(ctx context.Context, id int, req domain.UpdateProductRequest) (*domain.Product, error) {
	if m.updateProductFunc != nil {
		return m.updateProductFunc(ctx, id, req)
	}
	return nil, nil
}

func (m *mockProductService) DeleteProduct(ctx context.Context, id int) error {
	if m.deleteProductFunc != nil {
		return m.deleteProductFunc(ctx, id)
	}
	return nil
}

func (m *mockProductService) AdjustStock(ctx context.Context, productID int, req domain.AdjustStockRequest) (*domain.Product, error) {
	if m.adjustStockFunc != nil {
		return m.adjustStockFunc(ctx, productID, req)
	}
	return nil, nil
}

func (m *mockProductService) GetMovements(ctx context.Context, productID int) (*domain.StockMovementsResponse, error) {
	if m.getMovementsFunc != nil {
		return m.getMovementsFunc(ctx, productID)
	}
	return &domain.StockMovementsResponse{}, nil
}

func TestProductHandler_AdjustStock(t *testing.T) {
	t.Run("Status 200 - Berhasil menyesuaikan stok masuk", func(t *testing.T) {
		now := time.Now()
		mockSvc := &mockProductService{
			adjustStockFunc: func(ctx context.Context, productID int, req domain.AdjustStockRequest) (*domain.Product, error) {
				return &domain.Product{
					ID:             productID,
					SKU:            "SKU-001",
					Name:           "Kertas A4 70gr",
					Price:          45000,
					Stock:          15,
					IsActive:       true,
					LastMovementAt: &now,
				}, nil
			},
		}

		h := handler.NewProductHandler(mockSvc)
		body := `{"type":"in","qty":10,"note":"Restock dari supplier"}`
		req := httptest.NewRequest(http.MethodPost, "/api/products/1/stock", bytes.NewBufferString(body))
		req.SetPathValue("id", "1")
		rec := httptest.NewRecorder()

		h.AdjustStock(rec, req)

		if rec.Code != http.StatusOK {
			t.Errorf("expected status 200, got %d", rec.Code)
		}

		var prod domain.Product
		_ = json.NewDecoder(rec.Body).Decode(&prod)
		if prod.Stock != 15 {
			t.Errorf("expected stock 15, got %d", prod.Stock)
		}
	})

	t.Run("Status 409 - INSUFFICIENT_STOCK saat mutasi out melebihi stok yang ada", func(t *testing.T) {
		mockSvc := &mockProductService{
			adjustStockFunc: func(ctx context.Context, productID int, req domain.AdjustStockRequest) (*domain.Product, error) {
				return nil, domain.NewInsufficientStockError("Stok fisik tidak mencukupi untuk pengurangan", "SKU-001", 3)
			},
		}

		h := handler.NewProductHandler(mockSvc)
		body := `{"type":"out","qty":10,"note":"Barang rusak"}`
		req := httptest.NewRequest(http.MethodPost, "/api/products/1/stock", bytes.NewBufferString(body))
		req.SetPathValue("id", "1")
		rec := httptest.NewRecorder()

		h.AdjustStock(rec, req)

		if rec.Code != http.StatusConflict {
			t.Errorf("expected status 409, got %d", rec.Code)
		}

		var envelope domain.ErrorEnvelope
		_ = json.NewDecoder(rec.Body).Decode(&envelope)
		if envelope.Error.Code != domain.ErrCodeInsufficientStock {
			t.Errorf("expected INSUFFICIENT_STOCK, got %s", envelope.Error.Code)
		}
		if envelope.Error.Available == nil || *envelope.Error.Available != 3 {
			t.Errorf("expected available 3, got %v", envelope.Error.Available)
		}
	})

	t.Run("Status 400 - Type mutasi tidak valid", func(t *testing.T) {
		h := handler.NewProductHandler(&mockProductService{})
		body := `{"type":"invalid_direction","qty":5}`
		req := httptest.NewRequest(http.MethodPost, "/api/products/1/stock", bytes.NewBufferString(body))
		req.SetPathValue("id", "1")
		rec := httptest.NewRecorder()

		h.AdjustStock(rec, req)

		if rec.Code != http.StatusBadRequest {
			t.Errorf("expected status 400, got %d", rec.Code)
		}
	})
}

func TestProductHandler_DeleteProduct(t *testing.T) {
	t.Run("Status 409 - Ditolak jika produk memiliki riwayat mutasi", func(t *testing.T) {
		mockSvc := &mockProductService{
			deleteProductFunc: func(ctx context.Context, id int) error {
				return domain.NewConflictError(domain.ErrCodeProductHasHistory, "Produk tidak dapat dihapus karena memiliki riwayat mutasi stok")
			},
		}

		h := handler.NewProductHandler(mockSvc)
		req := httptest.NewRequest(http.MethodDelete, "/api/products/1", nil)
		req.SetPathValue("id", "1")
		rec := httptest.NewRecorder()

		h.DeleteProduct(rec, req)

		if rec.Code != http.StatusConflict {
			t.Errorf("expected status 409, got %d", rec.Code)
		}

		var envelope domain.ErrorEnvelope
		_ = json.NewDecoder(rec.Body).Decode(&envelope)
		if envelope.Error.Code != domain.ErrCodeProductHasHistory {
			t.Errorf("expected %s, got %s", domain.ErrCodeProductHasHistory, envelope.Error.Code)
		}
	})
}
