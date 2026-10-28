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

// mockOrderService mengimplementasikan service.OrderService untuk pengujian unit HTTP handler
type mockOrderService struct {
	createOrderFunc         func(ctx context.Context, req domain.CreateOrderRequest) (*domain.SalesOrder, error)
	getOrderByIDFunc        func(ctx context.Context, id int) (*domain.SalesOrder, error)
	cancelOrderFunc         func(ctx context.Context, id int) (*domain.SalesOrder, error)
	getDailySalesReportFunc func(ctx context.Context, date string) (*domain.DailySalesReport, error)
}

func (m *mockOrderService) CreateOrder(ctx context.Context, req domain.CreateOrderRequest) (*domain.SalesOrder, error) {
	if m.createOrderFunc != nil {
		return m.createOrderFunc(ctx, req)
	}
	return nil, nil
}

func (m *mockOrderService) GetOrderByID(ctx context.Context, id int) (*domain.SalesOrder, error) {
	if m.getOrderByIDFunc != nil {
		return m.getOrderByIDFunc(ctx, id)
	}
	return nil, nil
}

func (m *mockOrderService) CancelOrder(ctx context.Context, id int) (*domain.SalesOrder, error) {
	if m.cancelOrderFunc != nil {
		return m.cancelOrderFunc(ctx, id)
	}
	return nil, nil
}

func (m *mockOrderService) GetDailySalesReport(ctx context.Context, date string) (*domain.DailySalesReport, error) {
	if m.getDailySalesReportFunc != nil {
		return m.getDailySalesReportFunc(ctx, date)
	}
	return &domain.DailySalesReport{Date: date}, nil
}

func TestOrderHandler_CreateOrder(t *testing.T) {
	t.Run("Status 201 - Berhasil membuat order baru", func(t *testing.T) {
		mockSvc := &mockOrderService{
			createOrderFunc: func(ctx context.Context, req domain.CreateOrderRequest) (*domain.SalesOrder, error) {
				return &domain.SalesOrder{
					ID:        101,
					Customer:  req.Customer,
					Status:    domain.OrderStatusCreated,
					Total:     150000,
					CreatedAt: time.Now(),
					Items: []domain.SalesOrderItem{
						{ID: 1, OrderID: 101, SKU: "SKU-001", Qty: 2, UnitPrice: 75000},
					},
				}, nil
			},
		}

		h := handler.NewOrderHandler(mockSvc)
		body := `{"customer":"PT Maju Bersama","items":[{"sku":"SKU-001","qty":2}]}`
		req := httptest.NewRequest(http.MethodPost, "/api/orders", bytes.NewBufferString(body))
		rec := httptest.NewRecorder()

		h.CreateOrder(rec, req)

		if rec.Code != http.StatusCreated {
			t.Errorf("expected status %d, got %d", http.StatusCreated, rec.Code)
		}

		var createdOrder domain.SalesOrder
		if err := json.NewDecoder(rec.Body).Decode(&createdOrder); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}

		if createdOrder.ID != 101 || createdOrder.Total != 150000 {
			t.Errorf("unexpected order data: %+v", createdOrder)
		}
	})

	t.Run("Status 409 - INSUFFICIENT_STOCK menyertakan SKU dan Available", func(t *testing.T) {
		mockSvc := &mockOrderService{
			createOrderFunc: func(ctx context.Context, req domain.CreateOrderRequest) (*domain.SalesOrder, error) {
				return nil, domain.NewInsufficientStockError("Stok tidak mencukupi untuk SKU: SKU-999", "SKU-999", 2)
			},
		}

		h := handler.NewOrderHandler(mockSvc)
		body := `{"customer":"PT Kurang Stok","items":[{"sku":"SKU-999","qty":5}]}`
		req := httptest.NewRequest(http.MethodPost, "/api/orders", bytes.NewBufferString(body))
		rec := httptest.NewRecorder()

		h.CreateOrder(rec, req)

		if rec.Code != http.StatusConflict {
			t.Errorf("expected status 409, got %d", rec.Code)
		}

		var envelope domain.ErrorEnvelope
		if err := json.NewDecoder(rec.Body).Decode(&envelope); err != nil {
			t.Fatalf("failed to decode error envelope: %v", err)
		}

		if envelope.Error.Code != domain.ErrCodeInsufficientStock {
			t.Errorf("expected error code %s, got %s", domain.ErrCodeInsufficientStock, envelope.Error.Code)
		}
		if envelope.Error.SKU != "SKU-999" {
			t.Errorf("expected SKU 'SKU-999', got '%s'", envelope.Error.SKU)
		}
		if envelope.Error.Available == nil || *envelope.Error.Available != 2 {
			t.Errorf("expected available 2, got %v", envelope.Error.Available)
		}
	})

	t.Run("Status 400 - Format JSON rusak / malformed", func(t *testing.T) {
		h := handler.NewOrderHandler(&mockOrderService{})
		malformedBody := `{"customer": "Incomplete JSON`
		req := httptest.NewRequest(http.MethodPost, "/api/orders", bytes.NewBufferString(malformedBody))
		rec := httptest.NewRecorder()

		h.CreateOrder(rec, req)

		if rec.Code != http.StatusBadRequest {
			t.Errorf("expected status 400, got %d", rec.Code)
		}

		var envelope domain.ErrorEnvelope
		_ = json.NewDecoder(rec.Body).Decode(&envelope)
		if envelope.Error.Code != "MALFORMED_JSON" {
			t.Errorf("expected code 'MALFORMED_JSON', got '%s'", envelope.Error.Code)
		}
	})
}

func TestOrderHandler_GetDailySalesReport(t *testing.T) {
	t.Run("Status 200 - Berhasil mengambil laporan penjualan harian", func(t *testing.T) {
		mockSvc := &mockOrderService{
			getDailySalesReportFunc: func(ctx context.Context, date string) (*domain.DailySalesReport, error) {
				return &domain.DailySalesReport{
					Date:           date,
					TotalOrders:    5,
					TotalRevenue:   1500000,
					TotalItemsSold: 12,
				}, nil
			},
		}

		h := handler.NewOrderHandler(mockSvc)
		req := httptest.NewRequest(http.MethodGet, "/api/reports/daily-sales?date=2026-10-28", nil)
		rec := httptest.NewRecorder()

		h.GetDailySalesReport(rec, req)

		if rec.Code != http.StatusOK {
			t.Errorf("expected status 200, got %d", rec.Code)
		}

		var report domain.DailySalesReport
		if err := json.NewDecoder(rec.Body).Decode(&report); err != nil {
			t.Fatalf("failed to decode report: %v", err)
		}

		if report.TotalOrders != 5 || report.TotalRevenue != 1500000 || report.TotalItemsSold != 12 {
			t.Errorf("unexpected report output: %+v", report)
		}
	})
}

