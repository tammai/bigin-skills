package api

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"

	"{{MODULE}}/internal/api/middleware"
	"{{MODULE}}/internal/modules/users"
	"{{MODULE}}/internal/shared/apperr"
	"{{MODULE}}/internal/shared/auth"
	"{{MODULE}}/internal/shared/db"
	"{{MODULE}}/internal/shared/httpx"
)

const (
	testWebOrigin = "http://localhost:3000"
	// goodSession is the one cookie value testSessions recognises, as a
	// user-role caller. Everything else is an unknown session.
	goodSession = "good-session"
)

var testSessionCookie = httpx.SessionCookie{Name: "__Host-session", Secure: true}

// testSessions replaces the users module's resolver, which would need a
// database. The router wiring — which prefixes consult it, and in what order
// against CSRF — is what these tests are about, and that stays real.
type testSessions struct{}

func (testSessions) ResolveSession(_ context.Context, rawID string) (auth.Claims, error) {
	if rawID != goodSession {
		return auth.Claims{}, apperr.Unauthorized("Invalid or expired session")
	}
	return auth.Claims{UserID: 2, Role: auth.RoleUser}, nil
}

// newTestRouter builds the PRODUCTION router. Nothing here is a stand-in: the
// point of these tests is the wiring itself, and a router assembled by the test
// would prove nothing about the one that ships.
//
// No database is needed. The protected routes abort in the auth middleware
// before any handler runs, and the public auth routes fail binding on an empty
// body before reaching the repository — so users.New(nil, ...) is safe here.
// Session lookups go to testSessions for the same reason.
func newTestRouter(t *testing.T) *gin.Engine {
	t.Helper()
	gin.SetMode(gin.TestMode)

	issuer := auth.NewTokenIssuer([]byte("test-secret"), 15*time.Minute, 7*24*time.Hour)
	return NewRouter(Options{
		Spec:          []byte("openapi: 3.0.3"),
		CORSOrigins:   []string{"http://localhost:3000"},
		TokenIssuer:   issuer,
		Sessions:      testSessions{},
		SessionCookie: testSessionCookie,
		WebOrigins:    []string{testWebOrigin},
		Ping:          func() error { return db.Ping(nil) },
		Users: users.New(nil, issuer, users.Options{
			SessionIdleTTL:     72 * time.Hour,
			SessionAbsoluteTTL: 30 * 24 * time.Hour,
			SessionCookie:      testSessionCookie,
		}),
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

// The session endpoints are generated routes like any other, so the same
// failure applies in reverse: a contract path nobody wired answers 404. And
// they are public — a login that needed a session first could never succeed.
func TestSessionRoutesAreRegisteredAndPublic(t *testing.T) {
	r := newTestRouter(t)
	path := middleware.BaseURL + "/auth/session"

	// An empty body fails binding: proof the request reached the handler
	// past the rate limit, the auth selector and the Origin check.
	w := do(t, r, http.MethodPost, path, `{}`, map[string]string{"Origin": testWebOrigin})
	if w.Code != http.StatusBadRequest {
		t.Errorf("POST %s returned %d, want 400 from binding", path, w.Code)
	}

	// Logout with no cookie has nothing to delete and still succeeds — and
	// still clears the cookie, so a browser holding a dead one drops it.
	w = do(t, r, http.MethodDelete, path, "", map[string]string{"Origin": testWebOrigin})
	if w.Code != http.StatusOK {
		t.Errorf("DELETE %s returned %d, want 200", path, w.Code)
	}
	if got := w.Header().Get("Set-Cookie"); !strings.Contains(got, testSessionCookie.Name+"=;") || !strings.Contains(got, "Max-Age=0") {
		t.Errorf("DELETE %s Set-Cookie = %q, want the session cookie cleared", path, got)
	}

	// Login CSRF: without an allowlisted Origin, creating a session is refused
	// before the handler runs.
	w = do(t, r, http.MethodPost, path, `{}`, nil)
	if w.Code != http.StatusForbidden {
		t.Errorf("POST %s with no Origin returned %d, want 403", path, w.Code)
	}
}

// The browser login checks a password, so it is as rate-limited as the token
// login — with its own budget, so neither can exhaust the other's.
func TestCreateSessionIsRateLimited(t *testing.T) {
	r := newTestRouter(t)
	path := middleware.BaseURL + "/auth/session"

	var codes []int
	for range 8 {
		req := httptest.NewRequest(http.MethodPost, path, strings.NewReader(`{}`))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Origin", testWebOrigin)
		// A client IP no other test uses, so the budget starts full however
		// the tests are ordered.
		req.RemoteAddr = "198.51.100.23:4242"
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		codes = append(codes, w.Code)
	}

	if codes[0] == http.StatusTooManyRequests {
		t.Fatalf("the first request was rate-limited: %v", codes)
	}
	if codes[len(codes)-1] != http.StatusTooManyRequests {
		t.Errorf("8 rapid POSTs never hit the limit: %v — POST /auth/session has no RateLimitByPath case", codes)
	}
}

// The cookie is a full credential on the protected prefixes, subject to the
// same role check as a token and, on unsafe methods, to the Origin check.
func TestProtectedRoutesAcceptTheSessionCookie(t *testing.T) {
	r := newTestRouter(t)
	cookie := testSessionCookie.Name + "=" + goodSession

	cases := []struct {
		name, method, path, body string
		headers                  map[string]string
		want                     int
	}{
		// Authenticated by cookie, then refused on role: the cookie was read.
		{"admin prefix, user session", http.MethodGet, "/admin/users", "",
			map[string]string{"Cookie": cookie}, http.StatusForbidden},
		// Past auth and CSRF into the handler, which rejects the body.
		{"user prefix, unsafe, allowlisted origin", http.MethodPut, "/user/profile", `{"full_name": 1}`,
			map[string]string{"Cookie": cookie, "Origin": testWebOrigin}, http.StatusBadRequest},
		{"user prefix, unsafe, no origin", http.MethodPut, "/user/profile", `{"full_name": 1}`,
			map[string]string{"Cookie": cookie}, http.StatusForbidden},
		{"user prefix, unsafe, foreign origin", http.MethodPut, "/user/profile", `{"full_name": 1}`,
			map[string]string{"Cookie": cookie, "Origin": "https://evil.test"}, http.StatusForbidden},
		{"user prefix, unknown session", http.MethodGet, "/user/profile", "",
			map[string]string{"Cookie": testSessionCookie.Name + "=forged"}, http.StatusUnauthorized},
		// The insecure-mode name is a different cookie; a secure deployment
		// must not accept it.
		{"user prefix, wrong cookie name", http.MethodGet, "/user/profile", "",
			map[string]string{"Cookie": "session=" + goodSession}, http.StatusUnauthorized},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			w := do(t, r, tc.method, middleware.BaseURL+tc.path, tc.body, tc.headers)
			if w.Code != tc.want {
				t.Errorf("%s %s returned %d, want %d (body %s)", tc.method, tc.path, w.Code, tc.want, w.Body)
			}
		})
	}
}
