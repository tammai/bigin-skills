package middleware

import (
	"strings"

	"github.com/gin-gonic/gin"

	"{{MODULE}}/internal/shared/auth"
)

// BaseURL is the API version prefix.
//
// It is used in exactly two places — the generated router's registration
// (internal/api/router.go) and the selectors below — and both read this
// constant, so the prefix cannot drift between them. That drift used to be this
// scaffold's sharpest edge: routes are registered as BaseURL + the spec path,
// which is what c.FullPath() returns, so a BaseURL changed in one place and not
// the other made every case below fall through to `default: c.Next()` and
// silently turned protected routes public.
//
// What the constant CANNOT prevent is a new path prefix that nobody adds a case
// for. That route is public, compiles, and answers 200. router_test.go is the
// assertion that catches it.
const BaseURL = "/api/v1"

// Route prefixes, derived once so a new one has an obvious home.
const (
	userPrefix  = BaseURL + "/user"
	adminPrefix = BaseURL + "/admin"

	signupRoute = BaseURL + "/auth/signup"
	loginRoute  = BaseURL + "/auth/login"
)

// AuthByPath applies role-based auth by matched-route prefix. It exists because
// oapi-codegen's gin-server registers every operation on one router and does
// NOT enforce the contract's `security:` schemes — the generated code knows
// which routes are protected and does nothing about it.
func AuthByPath(issuer auth.TokenIssuer) gin.HandlerFunc {
	requireUser := Require(issuer, auth.RoleUser)
	requireAdmin := Require(issuer, auth.RoleAdmin)

	return func(c *gin.Context) {
		switch {
		case strings.HasPrefix(c.FullPath(), userPrefix):
			requireUser(c)
		case strings.HasPrefix(c.FullPath(), adminPrefix):
			requireAdmin(c)
		default:
			c.Next()
		}
	}
}

// RateLimitByPath gives the public auth endpoints their own budgets. Each route
// is limited independently, so a burst of signups cannot exhaust login's
// allowance and lock out legitimate users.
func RateLimitByPath() gin.HandlerFunc {
	signup := RateLimit("signup", 5, 5)
	login := RateLimit("login", 5, 5)

	return func(c *gin.Context) {
		switch c.FullPath() {
		case signupRoute:
			signup(c)
		case loginRoute:
			login(c)
		default:
			c.Next()
		}
	}
}
