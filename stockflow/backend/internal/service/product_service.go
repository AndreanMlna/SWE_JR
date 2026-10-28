package service

import (
	"context"
	"strings"

	"stockflow/backend/internal/domain"
	"stockflow/backend/internal/repository"
)

// ProductService mendefinisikan interface logika bisnis produk
type ProductService interface {
	GetProducts(ctx context.Context, filter domain.ProductFilter) (*domain.ProductListResponse, error)
	GetProductByID(ctx context.Context, id int) (*domain.Product, error)
	CreateProduct(ctx context.Context, req domain.CreateProductRequest) (*domain.Product, error)
	UpdateProduct(ctx context.Context, id int, req domain.UpdateProductRequest) (*domain.Product, error)
	DeleteProduct(ctx context.Context, id int) error
	AdjustStock(ctx context.Context, productID int, req domain.AdjustStockRequest) (*domain.Product, error)
	GetMovements(ctx context.Context, productID int) (*domain.StockMovementsResponse, error)
}

type productService struct {
	repo repository.ProductRepository
}

// NewProductService menginisialisasi implementasi ProductService
func NewProductService(repo repository.ProductRepository) ProductService {
	return &productService{repo: repo}
}

func (s *productService) GetProducts(ctx context.Context, filter domain.ProductFilter) (*domain.ProductListResponse, error) {
	products, total, err := s.repo.GetProducts(ctx, filter)
	if err != nil {
		return nil, err
	}
	return &domain.ProductListResponse{
		Data:  products,
		Page:  filter.Page,
		Limit: filter.Limit,
		Total: total,
	}, nil
}

func (s *productService) GetProductByID(ctx context.Context, id int) (*domain.Product, error) {
	if id <= 0 {
		return nil, domain.NewBadRequestError("INVALID_ID", "ID produk harus bernilai integer positif")
	}
	return s.repo.GetProductByID(ctx, id)
}

func (s *productService) CreateProduct(ctx context.Context, req domain.CreateProductRequest) (*domain.Product, error) {
	req.SKU = strings.TrimSpace(req.SKU)
	req.Name = strings.TrimSpace(req.Name)

	if req.SKU == "" {
		return nil, domain.NewBadRequestError("EMPTY_SKU", "SKU produk wajib diisi")
	}
	if req.Name == "" {
		return nil, domain.NewBadRequestError("EMPTY_NAME", "Nama produk wajib diisi")
	}
	if req.Price < 0 {
		return nil, domain.NewBadRequestError("INVALID_PRICE", "Harga produk harus bernilai integer >= 0 (IDR)")
	}

	return s.repo.CreateProduct(ctx, req)
}

func (s *productService) UpdateProduct(ctx context.Context, id int, req domain.UpdateProductRequest) (*domain.Product, error) {
	if id <= 0 {
		return nil, domain.NewBadRequestError("INVALID_ID", "ID produk harus bernilai integer positif")
	}
	if req.Price < 0 {
		return nil, domain.NewBadRequestError("INVALID_PRICE", "Harga produk harus bernilai integer >= 0")
	}
	return s.repo.UpdateProduct(ctx, id, req)
}

func (s *productService) DeleteProduct(ctx context.Context, id int) error {
	if id <= 0 {
		return domain.NewBadRequestError("INVALID_ID", "ID produk harus bernilai integer positif")
	}
	return s.repo.DeleteProduct(ctx, id)
}

func (s *productService) AdjustStock(ctx context.Context, productID int, req domain.AdjustStockRequest) (*domain.Product, error) {
	if productID <= 0 {
		return nil, domain.NewBadRequestError("INVALID_ID", "ID produk harus bernilai integer positif")
	}
	req.Type = strings.ToLower(strings.TrimSpace(req.Type))
	if req.Type != "in" && req.Type != "out" {
		return nil, domain.NewBadRequestError("INVALID_TYPE", "Tipe mutasi hanya boleh 'in' atau 'out'")
	}
	if req.Qty <= 0 {
		return nil, domain.NewBadRequestError("INVALID_QTY", "Kuantitas mutasi harus bernilai integer > 0")
	}

	return s.repo.AdjustStock(ctx, productID, req)
}

func (s *productService) GetMovements(ctx context.Context, productID int) (*domain.StockMovementsResponse, error) {
	if productID <= 0 {
		return nil, domain.NewBadRequestError("INVALID_ID", "ID produk harus bernilai integer positif")
	}
	movements, err := s.repo.GetMovements(ctx, productID)
	if err != nil {
		return nil, err
	}
	return &domain.StockMovementsResponse{
		Data: movements,
	}, nil
}
