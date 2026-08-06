package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

// newTestRouter builds the production router. No ConnectDB() and no real spec
// are needed for the assertions below: AuthMiddleware aborts before any handler
// touches config.DB, and the spec bytes only feed GET /openapi.yaml.
func newTestRouter(t *testing.T) *gin.Engine {
	t.Helper()
	gin.SetMode(gin.TestMode)
	return newRouter([]byte("openapi: 3.0.3"))
}

// The assertion that actually catches a stale selector prefix. If BaseURL in
// main.go and the prefixes in middleware.AuthByPath ever drift apart, every
// case falls through to `default: c.Next()` and these routes become PUBLIC —
// with nothing failing to compile and every response still 200.
func TestProtectedRoutesRejectAnonymous(t *testing.T) {
	router := newTestRouter(t)

	for _, path := range []string{"/api/v1/user/profile", "/api/v1/admin/users"} {
		req := httptest.NewRequest(http.MethodGet, path, nil) // no Authorization header
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		if w.Code != http.StatusUnauthorized {
			t.Errorf("%s returned %d, want 401 — AuthByPath prefix is stale, route is PUBLIC", path, w.Code)
		}
	}
}

// The mirror assertion: a prefix that grew too broad would lock the public auth
// endpoints behind a token nobody has yet, breaking signup and login entirely.
func TestPublicAuthRoutesAreReachable(t *testing.T) {
	router := newTestRouter(t)

	for _, path := range []string{"/api/v1/auth/signup", "/api/v1/auth/login"} {
		req := httptest.NewRequest(http.MethodPost, path, strings.NewReader(`{}`))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		// An empty body fails binding with 400 — which is proof the request
		// reached the handler instead of being turned away by auth.
		if w.Code == http.StatusUnauthorized {
			t.Errorf("%s returned 401 — AuthByPath prefix is too broad, a public route now requires a token", path)
		}
	}
}

func TestHealthzDoesNotRequireDatabase(t *testing.T) {
	router := newTestRouter(t)

	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Errorf("/healthz returned %d, want 200 — liveness must not depend on the DB", w.Code)
	}
}

// config.DB is nil here (no ConnectDB), so readiness must report unavailable
// rather than panic. This is the case that only shows up when a dependency is
// legitimately absent — the one a happy-path test never reaches.
func TestReadyzReportsUnavailableWithoutDatabase(t *testing.T) {
	router := newTestRouter(t)

	req := httptest.NewRequest(http.MethodGet, "/readyz", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	if w.Code != http.StatusServiceUnavailable {
		t.Errorf("/readyz returned %d, want 503 with no database connected", w.Code)
	}
}
