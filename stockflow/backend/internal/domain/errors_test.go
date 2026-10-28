package domain_test

import (
	"encoding/json"
	"errors"
	"net/http"
	"testing"

	"stockflow/backend/internal/domain"
)

func TestErrorEnvelope_Formatting(t *testing.T) {
	t.Run("Insufficient Stock Error Envelope", func(t *testing.T) {
		err := domain.NewInsufficientStockError("Stok tidak mencukupi untuk SKU: SKU-001", "SKU-001", 3)
		if err.StatusCode != http.StatusConflict {
			t.Errorf("expected status %d, got %d", http.StatusConflict, err.StatusCode)
		}
		if err.Code() != domain.ErrCodeInsufficientStock {
			t.Errorf("expected code %s, got %s", domain.ErrCodeInsufficientStock, err.Code())
		}
		if err.SKU() != "SKU-001" {
			t.Errorf("expected SKU 'SKU-001', got %s", err.SKU())
		}
		if err.Available() == nil || *err.Available() != 3 {
			t.Errorf("expected available 3, got %v", err.Available())
		}

		// Verifikasi serialisasi JSON sesuai kontrak API
		bytes, jsonErr := json.Marshal(err)
		if jsonErr != nil {
			t.Fatalf("failed to marshal error: %v", jsonErr)
		}

		expectedJSON := `{"error":{"code":"INSUFFICIENT_STOCK","message":"Stok tidak mencukupi untuk SKU: SKU-001","sku":"SKU-001","available":3}}`
		if string(bytes) != expectedJSON {
			t.Errorf("JSON output mismatch.\nExpected: %s\nGot:      %s", expectedJSON, string(bytes))
		}
	})

	t.Run("Bad Request Error Envelope without optional fields", func(t *testing.T) {
		err := domain.NewBadRequestError("INVALID_PAYLOAD", "Nama pelanggan wajib diisi")
		if err.StatusCode != http.StatusBadRequest {
			t.Errorf("expected status %d, got %d", http.StatusBadRequest, err.StatusCode)
		}

		bytes, jsonErr := json.Marshal(err)
		if jsonErr != nil {
			t.Fatalf("failed to marshal error: %v", jsonErr)
		}

		// sku dan available harus di-omit (omitempty) saat nil/kosong
		expectedJSON := `{"error":{"code":"INVALID_PAYLOAD","message":"Nama pelanggan wajib diisi"}}`
		if string(bytes) != expectedJSON {
			t.Errorf("JSON output mismatch.\nExpected: %s\nGot:      %s", expectedJSON, string(bytes))
		}
	})

	t.Run("Internal Error Masking", func(t *testing.T) {
		originalErr := errors.New("pq: connection refused")
		err := domain.NewInternalError(originalErr)
		if err.StatusCode != http.StatusInternalServerError {
			t.Errorf("expected status 500, got %d", err.StatusCode)
		}
		if err.Code() != "INTERNAL_ERROR" {
			t.Errorf("expected code INTERNAL_ERROR, got %s", err.Code())
		}
		// Pesan error ke client harus human readable dan tidak membocorkan credential internal
		if err.Message() != "Terjadi kesalahan internal pada server" {
			t.Errorf("unexpected internal message: %s", err.Message())
		}
	})
}
