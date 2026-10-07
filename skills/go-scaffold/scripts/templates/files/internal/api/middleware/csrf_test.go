package middleware

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"

	"{{MODULE}}/internal/shared/auth"
)

var testWebOrigins = []string{"https://app.example.com"}

// The full matrix: method × Origin × credential. Only one combination is
// refused — an unsafe method, authenticated by cookie, without an allowlisted
// Origin — and every neighbour of it is asserted to pass, so a check that grew
// too broad fails here as loudly as one that grew too narrow.
func TestCSRFMatrix(t *testing.T) {
	sessions := &fakeResolver{claims: auth.Claims{UserID: 2, Role: auth.RoleUser}}
	r := identityEngine(
		Authenticator{Tokens: testIssuer, Sessions: sessions, Cookie: testCookie},
		auth.RoleUser,
		CSRF(testWebOrigins),
	)

	origins := map[string]struct {
		value   string
		trusted bool
	}{
		"missing": {"", false},
		// Sent by sandboxed iframes and some redirects; names no origin.
		"null":  {"null", false},
		"wrong": {"https://evil.example", false},
		// A look-alike that a prefix or suffix match would let through.
		"suffix trick": {"https://app.example.com.evil.example", false},
		"right":        {"https://app.example.com", true},
		"right, different case and trailing slash": {"HTTPS://App.Example.com/", true},
	}
	credentials := map[string]map[string]string{
		"bearer": {"Authorization": bearerFor(t, 1, auth.RoleUser)},
		"cookie": {"Cookie": "__Host-session=good-session"},
	}
	methods := map[string]bool{ // method → safe
		http.MethodGet: true, http.MethodHead: true, http.MethodOptions: true,
		http.MethodPost: false, http.MethodPut: false, http.MethodDelete: false,
	}

	for method, safe := range methods {
		for originName, origin := range origins {
			for credName, cred := range credentials {
				name := strings.Join([]string{method, originName, credName}, "/")
				t.Run(name, func(t *testing.T) {
					headers := map[string]string{}
					for k, v := range cred {
						headers[k] = v
					}
					if origin.value != "" {
						headers["Origin"] = origin.value
					}

					want := http.StatusOK
					if !safe && credName == "cookie" && !origin.trusted {
						want = http.StatusForbidden
					}
					if w := send(r, method, headers); w.Code != want {
						t.Errorf("status = %d, want %d", w.Code, want)
					}
				})
			}
		}
	}
}

// An empty allowlist is the default, and it fails closed: every cookie
// mutation is refused until an operator names the web app's origin.
func TestCSRFWithAnEmptyAllowlistRefusesEveryCookieMutation(t *testing.T) {
	sessions := &fakeResolver{claims: auth.Claims{UserID: 2, Role: auth.RoleUser}}
	r := identityEngine(
		Authenticator{Tokens: testIssuer, Sessions: sessions, Cookie: testCookie},
		auth.RoleUser,
		CSRF(nil),
	)

	w := send(r, http.MethodPost, map[string]string{
		"Cookie": "__Host-session=good-session",
		"Origin": "https://app.example.com",
	})
	if w.Code != http.StatusForbidden {
		t.Errorf("status = %d, want 403", w.Code)
	}
}

// The session endpoints are public — nobody is authenticated yet when they
// log in — so "cookie-authenticated" cannot be what triggers the check there.
// Creating a session needs an allowlisted Origin regardless (login CSRF: a
// forged form would otherwise sign the victim into the attacker's account),
// and so does deleting one (forced logout).
func TestCSRFGuardsTheSessionEndpointsWithoutAnyCredential(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	ok := func(c *gin.Context) { c.Status(http.StatusOK) }
	r.POST(sessionRoute, CSRF(testWebOrigins), ok)
	r.DELETE(sessionRoute, CSRF(testWebOrigins), ok)
	// A public route that is not a session endpoint is not CSRF-checked: no
	// credential, nothing to forge.
	r.POST(loginRoute, CSRF(testWebOrigins), ok)

	cases := []struct {
		method, path, origin string
		want                 int
	}{
		{http.MethodPost, sessionRoute, "", http.StatusForbidden},
		{http.MethodPost, sessionRoute, "null", http.StatusForbidden},
		{http.MethodPost, sessionRoute, "https://evil.example", http.StatusForbidden},
		{http.MethodPost, sessionRoute, "https://app.example.com", http.StatusOK},
		{http.MethodDelete, sessionRoute, "", http.StatusForbidden},
		{http.MethodDelete, sessionRoute, "https://app.example.com", http.StatusOK},
		{http.MethodPost, loginRoute, "", http.StatusOK},
	}
	for _, tc := range cases {
		req := httptest.NewRequest(tc.method, tc.path, nil)
		if tc.origin != "" {
			req.Header.Set("Origin", tc.origin)
		}
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		if w.Code != tc.want {
			t.Errorf("%s %s Origin=%q: status = %d, want %d", tc.method, tc.path, tc.origin, w.Code, tc.want)
		}
	}
}
