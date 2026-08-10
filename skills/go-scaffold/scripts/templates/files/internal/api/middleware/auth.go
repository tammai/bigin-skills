// Package middleware holds the HTTP concerns that apply across modules: the
// bearer-token guard, the CORS allowlist, rate limiting, and the path selectors
// that decide which of those a given route gets.
//
// It sits on the transport side of the line. A module's application layer never
// imports it — what a use case needs from a request is the caller's identity,
// which arrives as an argument.
package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"{{MODULE}}/internal/shared/auth"
	"{{MODULE}}/internal/shared/httpx"
)

// Require verifies the bearer token and enforces a minimum role.
//
// "admin" satisfies every requirement — there is no role above it, so a
// separate admin bypass would just be this line written twice.
func Require(issuer auth.TokenIssuer, requiredRole string) gin.HandlerFunc {
	return func(c *gin.Context) {
		raw, ok := bearerToken(c.GetHeader("Authorization"))
		if !ok {
			abort(c, http.StatusUnauthorized, "Authorization token required")
			return
		}

		claims, err := issuer.Verify(raw)
		if err != nil {
			// The verification error is deliberately not echoed: its text
			// distinguishes "expired" from "bad signature", which tells an
			// attacker which half of a forged token to fix.
			abort(c, http.StatusUnauthorized, "Invalid or expired token")
			return
		}

		if requiredRole != "" && claims.Role != requiredRole && claims.Role != auth.RoleAdmin {
			abort(c, http.StatusForbidden, "Forbidden: insufficient role permissions")
			return
		}

		httpx.SetClaims(c, claims)
		c.Next()
	}
}

func bearerToken(header string) (string, bool) {
	const prefix = "Bearer "
	if !strings.HasPrefix(header, prefix) {
		return "", false
	}
	token := strings.TrimSpace(strings.TrimPrefix(header, prefix))
	return token, token != ""
}

func abort(c *gin.Context, status int, message string) {
	httpx.Error(c, status, message)
	c.Abort()
}
