package handler

import (
	"encoding/json"
	"errors"
	"net/http"

	"stockflow/backend/internal/domain"
)

// writeJSON menyederhanakan penulisan response JSON ke ResponseWriter
func writeJSON(w http.ResponseWriter, statusCode int, data interface{}) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(statusCode)
	if data != nil {
		_ = json.NewEncoder(w).Encode(data)
	}
}

// writeError memetakan error aplikasi ke unified error envelope JSON sesuai kontrak REST API
func writeError(w http.ResponseWriter, err error) {
	var appErr *domain.AppError
	if errors.As(err, &appErr) {
		writeJSON(w, appErr.StatusCode, domain.ErrorEnvelope{
			Error: appErr.Detail,
		})
		return
	}

	// Default fallback untuk error tak terduga (500)
	writeJSON(w, http.StatusInternalServerError, domain.ErrorEnvelope{
		Error: domain.ErrorDetail{
			Code:    "INTERNAL_ERROR",
			Message: "Terjadi kesalahan internal pada server",
		},
	})
}
