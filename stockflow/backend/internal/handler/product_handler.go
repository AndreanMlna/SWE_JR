package handler

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"stockflow/backend/internal/domain"
	"stockflow/backend/internal/service"
)

// ProductHandler menangani seluruh HTTP request untuk domain produk & pergerakan stok
type ProductHandler struct {
	service service.ProductService
}

// NewProductHandler menginisialisasi ProductHandler
func NewProductHandler(s service.ProductService) *ProductHandler {
	return &ProductHandler{service: s}
}

// GetProducts menangani GET /api/products?search=&page=&limit=
func (h *ProductHandler) GetProducts(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()
	search := query.Get("search")
	page, _ := strconv.Atoi(query.Get("page"))
	limit, _ := strconv.Atoi(query.Get("limit"))

	filter := domain.ProductFilter{
		Search: search,
		Page:   page,
		Limit:  limit,
	}

	res, err := h.service.GetProducts(r.Context(), filter)
	if err != nil {
		writeError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, res)
}

// CreateProduct menangani POST /api/products
func (h *ProductHandler) CreateProduct(w http.ResponseWriter, r *http.Request) {
	var req domain.CreateProductRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, domain.NewBadRequestError("MALFORMED_JSON", "Format JSON request tidak valid"))
		return
	}

	product, err := h.service.CreateProduct(r.Context(), req)
	if err != nil {
		writeError(w, err)
		return
	}

	writeJSON(w, http.StatusCreated, product)
}

// UpdateProduct menangani PUT /api/products/{id}
func (h *ProductHandler) UpdateProduct(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := strconv.Atoi(idStr)
	if err != nil || id <= 0 {
		writeError(w, domain.NewBadRequestError("INVALID_ID", "ID produk pada URL path tidak valid"))
		return
	}

	var req domain.UpdateProductRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, domain.NewBadRequestError("MALFORMED_JSON", "Format JSON request tidak valid"))
		return
	}

	product, err := h.service.UpdateProduct(r.Context(), id, req)
	if err != nil {
		writeError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, product)
}

// DeleteProduct menangani DELETE /api/products/{id}
func (h *ProductHandler) DeleteProduct(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := strconv.Atoi(idStr)
	if err != nil || id <= 0 {
		writeError(w, domain.NewBadRequestError("INVALID_ID", "ID produk pada URL path tidak valid"))
		return
	}

	err = h.service.DeleteProduct(r.Context(), id)
	if err != nil {
		writeError(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// AdjustStock menangani POST /api/products/{id}/stock
func (h *ProductHandler) AdjustStock(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := strconv.Atoi(idStr)
	if err != nil || id <= 0 {
		writeError(w, domain.NewBadRequestError("INVALID_ID", "ID produk pada URL path tidak valid"))
		return
	}

	var req domain.AdjustStockRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, domain.NewBadRequestError("MALFORMED_JSON", "Format JSON request tidak valid"))
		return
	}

	req.Type = strings.ToLower(strings.TrimSpace(req.Type))
	if req.Type != "in" && req.Type != "out" {
		writeError(w, domain.NewBadRequestError("INVALID_TYPE", "Tipe mutasi hanya boleh 'in' atau 'out'"))
		return
	}
	if req.Qty <= 0 {
		writeError(w, domain.NewBadRequestError("INVALID_QTY", "Kuantitas mutasi harus bernilai integer > 0"))
		return
	}

	product, err := h.service.AdjustStock(r.Context(), id, req)
	if err != nil {
		writeError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, product)
}

// GetMovements menangani GET /api/products/{id}/movements
func (h *ProductHandler) GetMovements(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := strconv.Atoi(idStr)
	if err != nil || id <= 0 {
		writeError(w, domain.NewBadRequestError("INVALID_ID", "ID produk pada URL path tidak valid"))
		return
	}

	res, err := h.service.GetMovements(r.Context(), id)
	if err != nil {
		writeError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, res)
}
