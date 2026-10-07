package middleware

import (
	"net/http"
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

	signupRoute  = BaseURL + "/auth/signup"
	loginRoute   = BaseURL + "/auth/login"
	sessionRoute = BaseURL + "/auth/session"
)

// AuthByPath applies role-based auth by matched-route prefix. It exists because
// oapi-codegen's gin-server registers every operation on one router and does
// NOT enforce the contract's `security:` schemes — the generated code knows
// which routes are protected and does nothing about it.
//
// Either credential satisfies these selectors — Bearer or session cookie — so
// the contract's two `security:` alternatives map to one guard per prefix.
func AuthByPath(a Authenticator) gin.HandlerFunc {
	requireUser := Require(a, auth.RoleUser)
	requireAdmin := Require(a, auth.RoleAdmin)

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

// csrfPublicRoutes are the public routes CSRF checks even though no credential
// authenticated the request. Every other public route carries nothing to
// forge; these two create and destroy the credential itself — a forged
// session create is login CSRF (the victim is signed into the attacker's
// account), a forged delete is a forced logout. A new public route that sets
// or clears the session cookie belongs here.
var csrfPublicRoutes = map[string]bool{
	sessionRoute: true, // POST create, DELETE logout
}

// RateLimitByPath gives the public auth endpoints their own budgets. Each route
// is limited independently, so a burst of signups cannot exhaust login's
// allowance and lock out legitimate users — and the browser login gets a budget
// of its own rather than sharing the token login's, for the same reason.
//
// Only POST /auth/session is limited: it is the one that checks a password.
// DELETE on the same path is logout, which guesses nothing.
func RateLimitByPath() gin.HandlerFunc {
	signup := RateLimit("signup", 5, 5)
	login := RateLimit("login", 5, 5)
	session := RateLimit("session", 5, 5)

	return func(c *gin.Context) {
		switch {
		case c.FullPath() == signupRoute:
			signup(c)
		case c.FullPath() == loginRoute:
			login(c)
		case c.FullPath() == sessionRoute && c.Request.Method == http.MethodPost:
			session(c)
		default:
			c.Next()
		}
	}
}
