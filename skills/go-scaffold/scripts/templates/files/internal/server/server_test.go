package server

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
)

// Full handler tests belong here alongside handlers.go — a fake satisfying
// store.Querier, table-driven cases, asserting status + decoded body against
// the generated contract types.

func TestHandleLiveness(t *testing.T) {
	s := &Server{}
	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	rec := httptest.NewRecorder()

	s.handleLiveness(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	require.Equal(t, "ok", rec.Body.String())
}

func TestHandleReadiness_NoPool(t *testing.T) {
	s := &Server{}
	req := httptest.NewRequest(http.MethodGet, "/readyz", nil)
	rec := httptest.NewRecorder()

	s.handleReadiness(rec, req)

	require.Equal(t, http.StatusServiceUnavailable, rec.Code)
}
