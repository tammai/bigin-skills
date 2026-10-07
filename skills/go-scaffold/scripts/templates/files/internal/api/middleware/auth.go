// Package middleware holds the HTTP concerns that apply across modules: the
// auth guard (Bearer token or session cookie), the CSRF Origin check, the CORS
// allowlist, rate limiting, and the path selectors that decide which of those a
// given route gets.
//
// It sits on the transport side of the line. A module's application layer never
// imports it — what a use case needs from a request is the caller's identity,
// which arrives as an argument.
package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"{{MODULE}}/internal/shared/apperr"
	"{{MODULE}}/internal/shared/auth"
	"{{MODULE}}/internal/shared/httpx"
)

// Authenticator is everything the guard needs to recognise a caller: the
// token issuer for Bearer requests, and the session resolver plus cookie
// definition for browser ones. Sessions is the kernel's interface, not the
// users module — this package imports no module, and the composition root
// supplies the implementation. A nil Sessions disables cookie auth.
type Authenticator struct {
	Tokens   auth.TokenIssuer
	Sessions auth.SessionResolver
	Cookie   httpx.SessionCookie
}

// viaCookieKey marks a request authenticated by the session cookie. CSRF reads
// it: a cookie is attached by the browser automatically, so it is the one
// credential a forged cross-site request can carry; a Bearer token is attached
// by the client's own code, so it is not.
const viaCookieKey = "middleware.viaCookie"

// Require authenticates the caller and enforces a minimum role.
//
// An Authorization header, if present, decides alone. A valid Bearer wins over
// a cookie; an invalid one is a 401 even when a valid cookie is also present —
// falling back would let anything able to attach a cookie paper over a forged
// or expired token. Only a request with no Authorization header at all is
// looked up by cookie.
//
// "admin" satisfies every requirement — there is no role above it, so a
// separate admin bypass would just be this line written twice.
func Require(a Authenticator, requiredRole string) gin.HandlerFunc {
	return func(c *gin.Context) {
		var claims auth.Claims
		if header := c.GetHeader("Authorization"); header != "" {
			raw, ok := bearerToken(header)
			if !ok {
				abort(c, http.StatusUnauthorized, "Authorization token required")
				return
			}
			verified, err := a.Tokens.Verify(raw)
			if err != nil {
				// The verification error is deliberately not echoed: its text
				// distinguishes "expired" from "bad signature", which tells an
				// attacker which half of a forged token to fix.
				abort(c, http.StatusUnauthorized, "Invalid or expired token")
				return
			}
			claims = verified
		} else if raw, ok := a.sessionID(c); ok {
			resolved, err := a.Sessions.ResolveSession(c.Request.Context(), raw)
			if err != nil {
				if apperr.KindOf(err) == apperr.KindUnauthorized {
					// One fixed message: missing, expired, idle and logged out
					// must be indistinguishable.
					abort(c, http.StatusUnauthorized, "Invalid or expired session")
					return
				}
				// Storage failure, not a verdict on the caller: a 401 here
				// would log every browser user out during a database blip.
				httpx.Fail(c, err)
				c.Abort()
				return
			}
			claims = resolved
			c.Set(viaCookieKey, true)
		} else {
			abort(c, http.StatusUnauthorized, "Authorization token required")
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

func (a Authenticator) sessionID(c *gin.Context) (string, bool) {
	if a.Sessions == nil {
		return "", false
	}
	return a.Cookie.Read(c)
}

func viaCookie(c *gin.Context) bool {
	return c.GetBool(viaCookieKey)
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
