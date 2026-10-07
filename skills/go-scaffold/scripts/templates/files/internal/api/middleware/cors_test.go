package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func corsEngine(allowed []string) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(CORS(allowed))
	r.GET("/x", func(c *gin.Context) { c.Status(http.StatusOK) })
	return r
}

func allowOrigin(r *gin.Engine, origin string) string {
	req := httptest.NewRequest(http.MethodGet, "/x", nil)
	req.Header.Set("Origin", origin)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w.Header().Get("Access-Control-Allow-Origin")
}

// CORS and CSRF must agree on what "the same origin" means. If CSRF accepted
// an Origin that CORS refused (or the reverse), a browser app would see its
// writes pass and its reads fail with no obvious cause.
func TestCORSComparesNormalisedOrigins(t *testing.T) {
	r := corsEngine([]string{"HTTPS://App.Example.com:443/", "http://localhost:3000"})

	for _, origin := range []string{"https://app.example.com", "http://localhost:3000"} {
		// The response echoes the request's own Origin byte for byte: the
		// browser compares it literally, not after normalising.
		if got := allowOrigin(r, origin); got != origin {
			t.Errorf("Origin %q: Allow-Origin = %q, want it echoed", origin, got)
		}
	}
	for _, origin := range []string{"https://app.example.com:8443", "https://evil.test", "null", "http://localhost:3000.evil.test"} {
		if got := allowOrigin(r, origin); got != "" {
			t.Errorf("Origin %q: Allow-Origin = %q, want none", origin, got)
		}
	}
}

// config refuses "*" at boot; the middleware must not honour one either, so a
// router built without config (a test, a second binary) can't reopen the hole.
func TestCORSNeverTreatsAStarAsAWildcard(t *testing.T) {
	r := corsEngine([]string{"*"})
	if got := allowOrigin(r, "https://evil.test"); got != "" {
		t.Errorf("Allow-Origin = %q with a \"*\" entry, want none", got)
	}
}
