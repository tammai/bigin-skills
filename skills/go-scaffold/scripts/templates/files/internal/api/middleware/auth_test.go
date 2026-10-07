package middleware

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"

	"{{MODULE}}/internal/shared/apperr"
	"{{MODULE}}/internal/shared/auth"
	"{{MODULE}}/internal/shared/httpx"
)

var (
	testIssuer = auth.NewTokenIssuer([]byte("test-secret"), 15*time.Minute, 7*24*time.Hour)
	testCookie = httpx.SessionCookie{Name: "__Host-session", Secure: true}
)

// fakeResolver stands in for the users module. calls is the point: the
// Bearer-wins and no-fallback rules are about whether the cookie is LOOKED AT,
// not just about the final status code.
type fakeResolver struct {
	claims auth.Claims
	err    error
	calls  int
}

func (f *fakeResolver) ResolveSession(_ context.Context, rawID string) (auth.Claims, error) {
	f.calls++
	if rawID != "good-session" {
		return auth.Claims{}, apperr.Unauthorized("Invalid or expired session")
	}
	return f.claims, f.err
}

// identityEngine answers 200 with the caller's user ID, so a test can tell
// WHICH credential authenticated the request, not just that one did.
func identityEngine(a Authenticator, role string, extra ...gin.HandlerFunc) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	handlers := append([]gin.HandlerFunc{Require(a, role)}, extra...)
	handlers = append(handlers, func(c *gin.Context) {
		claims, _ := httpx.ClaimsFrom(c)
		c.String(http.StatusOK, strconv.FormatUint(uint64(claims.UserID), 10))
	})
	for _, m := range []string{http.MethodGet, http.MethodHead, http.MethodOptions, http.MethodPost, http.MethodPut, http.MethodDelete} {
		r.Handle(m, "/protected", handlers...)
	}
	return r
}

func send(r *gin.Engine, method string, headers map[string]string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, "/protected", nil)
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func bearerFor(t *testing.T, userID uint, role string) string {
	t.Helper()
	token, err := testIssuer.Access(userID, role)
	if err != nil {
		t.Fatalf("minting a test token: %v", err)
	}
	return "Bearer " + token
}

func TestRequireAcceptsBearerOrCookie(t *testing.T) {
	sessions := &fakeResolver{claims: auth.Claims{UserID: 2, Role: auth.RoleUser}}
	r := identityEngine(Authenticator{Tokens: testIssuer, Sessions: sessions, Cookie: testCookie}, auth.RoleUser)

	cases := []struct {
		name        string
		headers     map[string]string
		wantStatus  int
		wantUser    string
		wantLookups int
	}{
		{"bearer only", map[string]string{"Authorization": bearerFor(t, 1, auth.RoleUser)}, 200, "1", 0},
		{"cookie only", map[string]string{"Cookie": "__Host-session=good-session"}, 200, "2", 1},
		// Both present: the Bearer decides and the cookie is never consulted.
		{"both", map[string]string{
			"Authorization": bearerFor(t, 1, auth.RoleUser),
			"Cookie":        "__Host-session=good-session",
		}, 200, "1", 0},
		// An invalid Bearer is a 401 even with a valid cookie beside it.
		// Falling back would let anything that can attach a cookie paper over
		// a forged or expired token — and would make "which credential did
		// this request use" depend on whether the first one happened to fail.
		{"invalid bearer, valid cookie", map[string]string{
			"Authorization": "Bearer not.a.jwt",
			"Cookie":        "__Host-session=good-session",
		}, 401, "", 0},
		{"non-bearer scheme, valid cookie", map[string]string{
			"Authorization": "Basic dXNlcjpwYXNz",
			"Cookie":        "__Host-session=good-session",
		}, 401, "", 0},
		{"unknown cookie", map[string]string{"Cookie": "__Host-session=stolen-or-expired"}, 401, "", 1},
		{"neither", nil, 401, "", 0},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			sessions.calls = 0
			w := send(r, http.MethodGet, tc.headers)
			if w.Code != tc.wantStatus {
				t.Fatalf("status = %d, want %d (body %s)", w.Code, tc.wantStatus, w.Body)
			}
			if tc.wantUser != "" && w.Body.String() != tc.wantUser {
				t.Errorf("authenticated as user %s, want %s", w.Body, tc.wantUser)
			}
			if sessions.calls != tc.wantLookups {
				t.Errorf("session lookups = %d, want %d", sessions.calls, tc.wantLookups)
			}
		})
	}
}

// The role check applies to a cookie identity exactly as to a token one.
func TestRequireEnforcesTheRoleForCookieSessions(t *testing.T) {
	sessions := &fakeResolver{claims: auth.Claims{UserID: 2, Role: auth.RoleUser}}
	r := identityEngine(Authenticator{Tokens: testIssuer, Sessions: sessions, Cookie: testCookie}, auth.RoleAdmin)

	w := send(r, http.MethodGet, map[string]string{"Cookie": "__Host-session=good-session"})
	if w.Code != http.StatusForbidden {
		t.Errorf("user-role session on an admin route returned %d, want 403", w.Code)
	}
}

// A storage failure is not a verdict on the caller. Answering 401 would log
// every browser user out during a database blip; answering 500 says what
// actually happened, through the same fixed-message path as every other 500.
func TestRequireReportsAStorageFailureAs500(t *testing.T) {
	sessions := &fakeResolver{err: apperr.Internal("Failed to load session", errors.New("pq: connection refused"))}
	r := identityEngine(Authenticator{Tokens: testIssuer, Sessions: sessions, Cookie: testCookie}, auth.RoleUser)

	w := send(r, http.MethodGet, map[string]string{"Cookie": "__Host-session=good-session"})
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500", w.Code)
	}
	if body := w.Body.String(); strings.Contains(body, "pq:") || strings.Contains(body, "refused") {
		t.Errorf("body %q leaks the driver error", body)
	}
}

// With no resolver wired, a cookie is just an unrelated header.
func TestRequireWithoutAResolverIgnoresCookies(t *testing.T) {
	r := identityEngine(Authenticator{Tokens: testIssuer, Cookie: testCookie}, auth.RoleUser)

	w := send(r, http.MethodGet, map[string]string{"Cookie": "__Host-session=good-session"})
	if w.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want 401", w.Code)
	}
}
