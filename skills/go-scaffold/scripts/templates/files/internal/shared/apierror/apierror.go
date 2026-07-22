// Package apierror is the shared error contract. Application/domain code returns
// an *AppError; the api layer's central handlers (see http.go) translate it into
// the fixed nested envelope { "error": { code, message, request_id, details } }
// (ADR §9.1). This REPLACES a flat {code,message} shape — the request_id and
// nested wrapper are load-bearing for the frontend and observability.
package apierror

import (
	"errors"
	"net/http"
)

// Detail is one field-level validation entry (ADR §9.1 `details`).
type Detail struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

// AppError carries the HTTP status explicitly so the handler never infers it
// from the code string.
type AppError struct {
	Status  int
	Code    string
	Message string
	Details []Detail
}

func (e *AppError) Error() string { return e.Code + ": " + e.Message }

// As extracts an *AppError from an error chain (nil, false if not one).
func As(err error) (*AppError, bool) {
	var ae *AppError
	if errors.As(err, &ae) {
		return ae, true
	}
	return nil, false
}

func New(status int, code, message string, details ...Detail) *AppError {
	return &AppError{Status: status, Code: code, Message: message, Details: details}
}

func BadRequest(code, message string, details ...Detail) *AppError {
	return New(http.StatusBadRequest, code, message, details...)
}
func Unauthenticated(code, message string) *AppError {
	return New(http.StatusUnauthorized, code, message)
}
func Unauthorized(code, message string) *AppError {
	return New(http.StatusForbidden, code, message)
}
func NotFound(code, message string) *AppError {
	return New(http.StatusNotFound, code, message)
}
func Conflict(code, message string) *AppError {
	return New(http.StatusConflict, code, message)
}
func Unprocessable(code, message string, details ...Detail) *AppError {
	return New(http.StatusUnprocessableEntity, code, message, details...)
}
