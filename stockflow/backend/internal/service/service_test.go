package service_test

import (
	"context"
	"errors"
	"testing"

	"stockflow/backend/internal/domain"
	"stockflow/backend/internal/service"
)

type mockProductRepo struct {
	getProductsFunc    func(ctx context.Context, filter domain.ProductFilter) ([]domain.Product, int, error)
	getProductByIDFunc  func(ctx context.Context, id int) (*domain.Product, error)
	getProductBySKUFunc func(ctx context.Context, sku string) (*domain.Product, error)
	createProductFunc   func(ctx context.Context, req domain.CreateProductRequest) (*domain.Product, error)
	updateProductFunc  func(ctx context.Context, id int, req domain.UpdateProductRequest) (*domain.Product, error)
	deleteProductFunc  func(ctx context.Context, id int) error
	adjustStockFunc    func(ctx context.Context, productID int, req domain.AdjustStockRequest) (*domain.Product, error)
	getMovementsFunc   func(ctx context.Context, productID int) ([]domain.StockMovement, error)
}

func (m *mockProductRepo) GetProducts(ctx context.Context, filter domain.ProductFilter) ([]domain.Product, int, error) {
	if m.getProductsFunc != nil {
		return m.getProductsFunc(ctx, filter)
	}
	return []domain.Product{}, 0, nil
}

func (m *mockProductRepo) GetProductByID(ctx context.Context, id int) (*domain.Product, error) {
	if m.getProductByIDFunc != nil {
		return m.getProductByIDFunc(ctx, id)
	}
	return nil, nil
}

func (m *mockProductRepo) GetProductBySKU(ctx context.Context, sku string) (*domain.Product, error) {
	if m.getProductBySKUFunc != nil {
		return m.getProductBySKUFunc(ctx, sku)
	}
	return nil, nil
}

func (m *mockProductRepo) CreateProduct(ctx context.Context, req domain.CreateProductRequest) (*domain.Product, error) {
	if m.createProductFunc != nil {
		return m.createProductFunc(ctx, req)
	}
	return nil, nil
}

func (m *mockProductRepo) UpdateProduct(ctx context.Context, id int, req domain.UpdateProductRequest) (*domain.Product, error) {
	if m.updateProductFunc != nil {
		return m.updateProductFunc(ctx, id, req)
	}
	return nil, nil
}

func (m *mockProductRepo) DeleteProduct(ctx context.Context, id int) error {
	if m.deleteProductFunc != nil {
		return m.deleteProductFunc(ctx, id)
	}
	return nil
}

func (m *mockProductRepo) AdjustStock(ctx context.Context, productID int, req domain.AdjustStockRequest) (*domain.Product, error) {
	if m.adjustStockFunc != nil {
		return m.adjustStockFunc(ctx, productID, req)
	}
	return nil, nil
}

func (m *mockProductRepo) GetMovements(ctx context.Context, productID int) ([]domain.StockMovement, error) {
	if m.getMovementsFunc != nil {
		return m.getMovementsFunc(ctx, productID)
	}
	return []domain.StockMovement{}, nil
}

func TestProductService_ValidationRules(t *testing.T) {
	svc := service.NewProductService(&mockProductRepo{})
	ctx := context.Background()

	t.Run("CreateProduct - Empty SKU rejected with 400", func(t *testing.T) {
		_, err := svc.CreateProduct(ctx, domain.CreateProductRequest{
			SKU:   "   ",
			Name:  "Pensil 2B",
			Price: 5000,
		})
		if err == nil {
			t.Fatalf("expected error, got nil")
		}
		var appErr *domain.AppError
		if !errors.As(err, &appErr) || appErr.StatusCode != 400 || appErr.Code() != "EMPTY_SKU" {
			t.Errorf("expected 400 EMPTY_SKU, got %v", err)
		}
	})

	t.Run("CreateProduct - Empty Name rejected with 400", func(t *testing.T) {
		_, err := svc.CreateProduct(ctx, domain.CreateProductRequest{
			SKU:   "SKU-100",
			Name:  "",
			Price: 5000,
		})
		if err == nil {
			t.Fatalf("expected error, got nil")
		}
		var appErr *domain.AppError
		if !errors.As(err, &appErr) || appErr.StatusCode != 400 || appErr.Code() != "EMPTY_NAME" {
			t.Errorf("expected 400 EMPTY_NAME, got %v", err)
		}
	})

	t.Run("CreateProduct - Negative Price rejected with 400", func(t *testing.T) {
		_, err := svc.CreateProduct(ctx, domain.CreateProductRequest{
			SKU:   "SKU-100",
			Name:  "Buku Tulis",
			Price: -100,
		})
		if err == nil {
			t.Fatalf("expected error, got nil")
		}
		var appErr *domain.AppError
		if !errors.As(err, &appErr) || appErr.StatusCode != 400 || appErr.Code() != "INVALID_PRICE" {
			t.Errorf("expected 400 INVALID_PRICE, got %v", err)
		}
	})

	t.Run("AdjustStock - Invalid Qty <= 0 rejected with 400", func(t *testing.T) {
		_, err := svc.AdjustStock(ctx, 1, domain.AdjustStockRequest{
			Type: "in",
			Qty:  0,
		})
		if err == nil {
			t.Fatalf("expected error, got nil")
		}
		var appErr *domain.AppError
		if !errors.As(err, &appErr) || appErr.StatusCode != 400 || appErr.Code() != "INVALID_QTY" {
			t.Errorf("expected 400 INVALID_QTY, got %v", err)
		}
	})

	t.Run("AdjustStock - Invalid Type rejected with 400", func(t *testing.T) {
		_, err := svc.AdjustStock(ctx, 1, domain.AdjustStockRequest{
			Type: "transfer",
			Qty:  10,
		})
		if err == nil {
			t.Fatalf("expected error, got nil")
		}
		var appErr *domain.AppError
		if !errors.As(err, &appErr) || appErr.StatusCode != 400 || appErr.Code() != "INVALID_TYPE" {
			t.Errorf("expected 400 INVALID_TYPE, got %v", err)
		}
	})
}
