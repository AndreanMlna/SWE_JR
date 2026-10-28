package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"stockflow/backend/internal/domain"
	"stockflow/backend/internal/service"
)

// OrderHandler menangani endpoint transaksi Sales Order
type OrderHandler struct {
	service service.OrderService
}

// NewOrderHandler menginisialisasi OrderHandler
func NewOrderHandler(s service.OrderService) *OrderHandler {
	return &OrderHandler{service: s}
}

// CreateOrder menangani POST /api/orders
func (h *OrderHandler) CreateOrder(w http.ResponseWriter, r *http.Request) {
	var req domain.CreateOrderRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, domain.NewBadRequestError("MALFORMED_JSON", "Format JSON request tidak valid"))
		return
	}

	order, err := h.service.CreateOrder(r.Context(), req)
	if err != nil {
		writeError(w, err)
		return
	}

	writeJSON(w, http.StatusCreated, order)
}

// GetOrderByID menangani GET /api/orders/{id}
func (h *OrderHandler) GetOrderByID(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := strconv.Atoi(idStr)
	if err != nil || id <= 0 {
		writeError(w, domain.NewBadRequestError("INVALID_ID", "ID pesanan pada URL path tidak valid"))
		return
	}

	order, err := h.service.GetOrderByID(r.Context(), id)
	if err != nil {
		writeError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, order)
}

// CancelOrder menangani POST /api/orders/{id}/cancel
func (h *OrderHandler) CancelOrder(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := strconv.Atoi(idStr)
	if err != nil || id <= 0 {
		writeError(w, domain.NewBadRequestError("INVALID_ID", "ID pesanan pada URL path tidak valid"))
		return
	}

	order, err := h.service.CancelOrder(r.Context(), id)
	if err != nil {
		writeError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, order)
}
