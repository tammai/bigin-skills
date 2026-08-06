package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func corsProbe(t *testing.T, allowlist, origin, method string) *httptest.ResponseRecorder {
	t.Helper()
	t.Setenv("CORS_ORIGINS", allowlist)
	gin.SetMode(gin.TestMode)

	r := gin.New()
	r.Use(CORS())
	r.GET("/probe", func(c *gin.Context) { c.Status(http.StatusOK) })

	req := httptest.NewRequest(method, "/probe", nil)
	if origin != "" {
		req.Header.Set("Origin", origin)
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func TestCORSOnlyEchoesAllowlistedOrigins(t *testing.T) {
	allowed := corsProbe(t, "http://localhost:3000", "http://localhost:3000", http.MethodGet)
	if got := allowed.Header().Get("Access-Control-Allow-Origin"); got != "http://localhost:3000" {
		t.Errorf("allowlisted origin got %q, want it echoed back", got)
	}

	// An origin outside the allowlist must get NO CORS header at all — sending
	// one back with credentials enabled is what makes any site able to drive an
	// authenticated session against this API.
	denied := corsProbe(t, "http://localhost:3000", "https://evil.example", http.MethodGet)
	if got := denied.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Errorf("unlisted origin got Access-Control-Allow-Origin %q, want none", got)
	}
}

func TestCORSPreflightShortCircuits(t *testing.T) {
	w := corsProbe(t, "http://localhost:3000", "http://localhost:3000", http.MethodOptions)
	if w.Code != http.StatusNoContent {
		t.Errorf("OPTIONS returned %d, want 204", w.Code)
	}
}
