package service

import (
	"context"

	"stockflow/backend/internal/domain"
	"stockflow/backend/internal/repository"
)

// OrderService mendefinisikan interface bisnis pembuatan dan pengelolaan order
type OrderService interface {
	CreateOrder(ctx context.Context, req domain.CreateOrderRequest) (*domain.SalesOrder, error)
	GetOrderByID(ctx context.Context, id int) (*domain.SalesOrder, error)
	CancelOrder(ctx context.Context, id int) (*domain.SalesOrder, error)
	GetDailySalesReport(ctx context.Context, date string) (*domain.DailySalesReport, error)
}

type orderService struct {
	repo repository.OrderRepository
}

// NewOrderService menginisialisasi implementasi OrderService
func NewOrderService(repo repository.OrderRepository) OrderService {
	return &orderService{repo: repo}
}

func (s *orderService) CreateOrder(ctx context.Context, req domain.CreateOrderRequest) (*domain.SalesOrder, error) {
	return s.repo.CreateOrder(ctx, req)
}

func (s *orderService) GetOrderByID(ctx context.Context, id int) (*domain.SalesOrder, error) {
	if id <= 0 {
		return nil, domain.NewBadRequestError("INVALID_ID", "ID pesanan harus bernilai integer positif")
	}
	return s.repo.GetOrderByID(ctx, id)
}

func (s *orderService) CancelOrder(ctx context.Context, id int) (*domain.SalesOrder, error) {
	if id <= 0 {
		return nil, domain.NewBadRequestError("INVALID_ID", "ID pesanan harus bernilai integer positif")
	}
	return s.repo.CancelOrder(ctx, id)
}

func (s *orderService) GetDailySalesReport(ctx context.Context, date string) (*domain.DailySalesReport, error) {
	return s.repo.GetDailySalesReport(ctx, date)
}

