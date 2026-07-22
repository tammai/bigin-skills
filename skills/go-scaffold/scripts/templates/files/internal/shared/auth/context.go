package auth

import (
	"context"
	"net/http"
	"strings"

	"{{MODULE}}/internal/shared/apierror"
)

// Principal is the authenticated caller (ADR §7 minimal claims): id + roles.
type Principal struct {
	Sub   string
	Roles []string
}

type ctxKey int

const principalKey ctxKey = iota

func withPrincipal(ctx context.Context, p Principal) context.Context {
	return context.WithValue(ctx, principalKey, p)
}

// PrincipalFromContext returns the authenticated principal if one is bound.
func PrincipalFromContext(ctx context.Context) (Principal, bool) {
	p, ok := ctx.Value(principalKey).(Principal)
	return p, ok
}

// Require is the handler-side guard: it returns the principal or a 401 AppError.
// Authentication (identity) lives here; authorization (RBAC) lives in the
// use-case via Can().
func Require(ctx context.Context) (Principal, error) {
	p, ok := PrincipalFromContext(ctx)
	if !ok {
		return Principal{}, apierror.Unauthenticated(apierror.CodeUnauthenticated, "authentication required")
	}
	return p, nil
}

// Middleware parses a Bearer token when present and binds the principal into the
// request context. It does NOT reject unauthenticated or invalid-token requests
// — public routes (signup, login, refresh) must stay reachable; protected
// handlers call Require(ctx) to enforce identity.
func Middleware(j *JWT) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			header := r.Header.Get("Authorization")
			if token, ok := strings.CutPrefix(header, "Bearer "); ok && token != "" {
				if p, err := j.Parse(token); err == nil {
					r = r.WithContext(withPrincipal(r.Context(), p))
				}
			}
			next.ServeHTTP(w, r)
		})
	}
}
