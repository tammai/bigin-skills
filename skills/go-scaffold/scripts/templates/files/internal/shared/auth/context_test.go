package auth

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"{{MODULE}}/internal/shared/apierror"
)

// Middleware only PARSES a bearer token; it must never reject. Require is the
// guard that 401s when no principal was bound. Together they must treat every
// malformed/absent credential as unauthenticated — never crash, never
// accidentally authenticate.
func TestMiddlewareAndRequire(t *testing.T) {
	j := NewJWT("test-secret-value", 15*time.Minute)
	valid, err := j.Sign("u1", []string{RoleUser})
	if err != nil {
		t.Fatalf("sign: %v", err)
	}

	var gotPrincipal Principal
	var requireErr error
	terminal := http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
		gotPrincipal, requireErr = Require(r.Context())
	})
	h := Middleware(j)(terminal)

	tests := []struct {
		name       string
		setHeader  bool
		header     string
		wantAuthed bool
	}{
		{name: "missing Authorization header", setHeader: false, wantAuthed: false},
		{name: "non-Bearer scheme", setHeader: true, header: "Basic dXNlcjpwYXNz", wantAuthed: false},
		{name: "empty token after Bearer prefix", setHeader: true, header: "Bearer ", wantAuthed: false},
		{name: "syntactically garbage token", setHeader: true, header: "Bearer not.a.jwt", wantAuthed: false},
		{name: "valid token authenticates", setHeader: true, header: "Bearer " + valid, wantAuthed: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotPrincipal, requireErr = Principal{}, nil
			req := httptest.NewRequest(http.MethodGet, "/", nil)
			if tt.setHeader {
				req.Header.Set("Authorization", tt.header)
			}
			h.ServeHTTP(httptest.NewRecorder(), req)

			if tt.wantAuthed {
				if requireErr != nil {
					t.Fatalf("Require returned an error for a valid token: %v", requireErr)
				}
				if gotPrincipal.Sub != "u1" {
					t.Fatalf("principal.Sub = %q, want u1", gotPrincipal.Sub)
				}
				return
			}

			if requireErr == nil {
				t.Fatalf("expected Require to fail (unauthenticated), bound principal %+v", gotPrincipal)
			}
			ae, ok := apierror.As(requireErr)
			if !ok || ae.Status != http.StatusUnauthorized {
				t.Fatalf("want a 401 AppError, got %v", requireErr)
			}
		})
	}
}
