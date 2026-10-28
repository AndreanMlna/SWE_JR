package domain

import "fmt"

// ErrorEnvelope mendefinisikan struktur amplop JSON terstandarisasi untuk seluruh error API
type ErrorEnvelope struct {
	Error ErrorDetail `json:"error"`
}

// ErrorDetail memuat rincian kode error mesin, pesan manusiawi, dan metadata kontekstual (sku & available)
type ErrorDetail struct {
	Code      string `json:"code"`
	Message   string `json:"message"`
	SKU       string `json:"sku,omitempty"`
	Available *int   `json:"available,omitempty"`
}

// AppError adalah tipe error kustom yang membungkus status HTTP dan ErrorDetail
type AppError struct {
	StatusCode int
	Detail     ErrorDetail
	Err        error
}

func (e *AppError) Error() string {
	if e.Err != nil {
		return fmt.Sprintf("[%s] %s: %v", e.Detail.Code, e.Detail.Message, e.Err)
	}
	return fmt.Sprintf("[%s] %s", e.Detail.Code, e.Detail.Message)
}

func (e *AppError) Unwrap() error {
	return e.Err
}

// Factory helper functions untuk standarisasi error
func NewBadRequestError(code, message string) *AppError {
	return &AppError{
		StatusCode: 400,
		Detail: ErrorDetail{
			Code:    code,
			Message: message,
		},
	}
}

func NewNotFoundError(code, message string) *AppError {
	return &AppError{
		StatusCode: 404,
		Detail: ErrorDetail{
			Code:    code,
			Message: message,
		},
	}
}

func NewConflictError(code, message string) *AppError {
	return &AppError{
		StatusCode: 409,
		Detail: ErrorDetail{
			Code:    code,
			Message: message,
		},
	}
}

func NewInsufficientStockError(message, sku string, available int) *AppError {
	return &AppError{
		StatusCode: 409,
		Detail: ErrorDetail{
			Code:      "INSUFFICIENT_STOCK",
			Message:   message,
			SKU:       sku,
			Available: &available,
		},
	}
}

func NewInternalError(err error) *AppError {
	return &AppError{
		StatusCode: 500,
		Detail: ErrorDetail{
			Code:    "INTERNAL_ERROR",
			Message: "Terjadi kesalahan internal pada server",
		},
		Err: err,
	}
}
