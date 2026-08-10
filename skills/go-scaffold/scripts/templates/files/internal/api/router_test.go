package api

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"

	"{{MODULE}}/internal/api/middleware"
	"{{MODULE}}/internal/modules/users"
	"{{MODULE}}/internal/shared/auth"
	"{{MODULE}}/internal/shared/db"
)

// newTestRouter builds the PRODUCTION router. Nothing here is a stand-in: the
// point of these tests is the wiring itself, and a router assembled by the test
// would prove nothing about the one that ships.
//
// No database is needed. The protected routes abort in the auth middleware
// before any handler runs, and the public auth routes fail binding on an empty
// body before reaching the repository — so users.New(nil, ...) is safe here.
func newTestRouter(t *testing.T) *gin.Engine {
	t.Helper()
	gin.SetMode(gin.TestMode)

	issuer := auth.NewTokenIssuer([]byte("test-secret"), 15*time.Minute, 7*24*time.Hour)
	return NewRouter(Options{
		Spec:        []byte("openapi: 3.0.3"),
		CORSOrigins: []string{"http://localhost:3000"},
		TokenIssuer: issuer,
		Ping:        func() error { return db.Ping(nil) },
		Users:       users.New(nil, issuer),
	})
}

func do(t *testing.T, r *gin.Engine, method, path string, body string, headers map[string]string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	if body != "" {
		req.Header.Set("Content-Type", "application/json")
	}
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

// The assertion that catches a missing selector case. If a protected prefix has
// no case in middleware.AuthByPath, every request falls through to
// `default: c.Next()`, the route becomes PUBLIC, and nothing fails to compile.
func TestProtectedRoutesRejectAnonymous(t *testing.T) {
	r := newTestRouter(t)

	for _, path := range []string{
		middleware.BaseURL + "/user/profile",
		middleware.BaseURL + "/admin/users",
	} {
		w := do(t, r, http.MethodGet, path, "", nil)
		if w.Code != http.StatusUnauthorized {
			t.Errorf("GET %s returned %d, want 401 — the route has no AuthByPath case and is PUBLIC", path, w.Code)
		}
	}
}

// The mirror assertion: a prefix that grew too broad would put the public auth
// endpoints behind a token nobody has yet, breaking signup and login outright.
func TestPublicAuthRoutesAreReachable(t *testing.T) {
	r := newTestRouter(t)

	for _, path := range []string{
		middleware.BaseURL + "/auth/signup",
		middleware.BaseURL + "/auth/login",
	} {
		w := do(t, r, http.MethodPost, path, `{}`, nil)
		// An empty body fails binding with 400, which is proof the request
		// reached the handler instead of being turned away by auth.
		if w.Code == http.StatusUnauthorized {
			t.Errorf("POST %s returned 401 — an AuthByPath prefix is too broad and a public route now needs a token", path)
		}
	}
}

// Role separation, asserted through the real middleware: a valid user token is
// authenticated but must not reach an admin route.
func TestAdminRoutesRejectAUserToken(t *testing.T) {
	r := newTestRouter(t)
	issuer := auth.NewTokenIssuer([]byte("test-secret"), 15*time.Minute, 7*24*time.Hour)

	token, err := issuer.Access(1, auth.RoleUser)
	if err != nil {
		t.Fatalf("minting a test token: %v", err)
	}

	w := do(t, r, http.MethodGet, middleware.BaseURL+"/admin/users", "", map[string]string{
		"Authorization": "Bearer " + token,
	})
	if w.Code != http.StatusForbidden {
		t.Errorf("admin route with a user token returned %d, want 403", w.Code)
	}
}

func TestGarbageTokensAreRejected(t *testing.T) {
	r := newTestRouter(t)
	path := middleware.BaseURL + "/user/profile"

	cases := map[string]string{
		"no scheme":     "some-token",
		"wrong scheme":  "Basic dXNlcjpwYXNz",
		"empty bearer":  "Bearer ",
		"not a jwt":     "Bearer not.a.jwt",
		"foreign issue": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIn0.badsig",
	}
	for name, header := range cases {
		t.Run(name, func(t *testing.T) {
			w := do(t, r, http.MethodGet, path, "", map[string]string{"Authorization": header})
			if w.Code != http.StatusUnauthorized {
				t.Errorf("returned %d, want 401", w.Code)
			}
		})
	}
}

func TestHealthzDoesNotRequireDatabase(t *testing.T) {
	r := newTestRouter(t)

	w := do(t, r, http.MethodGet, "/healthz", "", nil)
	if w.Code != http.StatusOK {
		t.Errorf("/healthz returned %d, want 200 — liveness must not depend on the DB", w.Code)
	}
}

// No database is wired here, so readiness must report unavailable rather than
// panic. This is the case that only shows up when a dependency is legitimately
// absent — the one a happy-path test never reaches.
func TestReadyzReportsUnavailableWithoutDatabase(t *testing.T) {
	r := newTestRouter(t)

	w := do(t, r, http.MethodGet, "/readyz", "", nil)
	if w.Code != http.StatusServiceUnavailable {
		t.Errorf("/readyz returned %d, want 503 with no database connected", w.Code)
	}
}

func TestOpenAPISpecIsServed(t *testing.T) {
	r := newTestRouter(t)

	w := do(t, r, http.MethodGet, "/openapi.yaml", "", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("/openapi.yaml returned %d, want 200", w.Code)
	}
	if !strings.Contains(w.Body.String(), "openapi:") {
		t.Error("/openapi.yaml did not serve the contract bytes")
	}
}

// A wildcard origin combined with credentials is the misconfiguration that lets
// any site drive an authenticated session, so an unlisted origin must simply
// get no CORS headers back.
func TestCORSOnlyEchoesAllowlistedOrigins(t *testing.T) {
	r := newTestRouter(t)

	allowed := do(t, r, http.MethodGet, "/healthz", "", map[string]string{"Origin": "http://localhost:3000"})
	if got := allowed.Header().Get("Access-Control-Allow-Origin"); got != "http://localhost:3000" {
		t.Errorf("allowlisted origin got %q, want it echoed back", got)
	}

	denied := do(t, r, http.MethodGet, "/healthz", "", map[string]string{"Origin": "https://evil.test"})
	if got := denied.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Errorf("unlisted origin got %q, want no CORS header at all", got)
	}
}
