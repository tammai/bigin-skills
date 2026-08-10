// Package httpx is the transport boundary: how a result or an error becomes a
// response, and how a handler reads the authenticated caller.
//
// Every response the API sends goes through OK or Fail, so there is exactly one
// success envelope and exactly one error shape ({"error": "..."}) — including
// the generated router's own parameter-binding failures, which internal/api
// remaps through Error.
package httpx

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"{{MODULE}}/internal/shared/apperr"
	"{{MODULE}}/internal/shared/auth"
)

// claimsKey is unexported so the only way to put an identity on the request is
// SetClaims, from the auth middleware. A handler cannot invent one.
const claimsKey = "httpx.claims"

func SetClaims(c *gin.Context, claims auth.Claims) {
	c.Set(claimsKey, claims)
}

// ClaimsFrom returns the verified caller. The ok result is false on any route
// the auth middleware did not cover — a handler that needs an identity must
// treat that as 401 rather than assuming a zero user ID.
func ClaimsFrom(c *gin.Context) (auth.Claims, bool) {
	v, exists := c.Get(claimsKey)
	if !exists {
		return auth.Claims{}, false
	}
	claims, ok := v.(auth.Claims)
	return claims, ok
}

// OK writes a success response.
func OK(c *gin.Context, status int, data any) {
	c.JSON(status, data)
}

// Error writes the API's single error shape with an explicit status. Use it for
// failures that originate in the transport layer itself — a binding error, a
// rejected token. Anything coming up from application or domain goes to Fail.
func Error(c *gin.Context, status int, message string) {
	c.JSON(status, gin.H{"error": message})
}

// Fail is the ONE place a Go error becomes an HTTP status.
//
// Handlers pass errors up unexamined; an error that isn't a typed apperr
// becomes 500 with a fixed message, so a leaked driver error naming tables,
// columns, or the DSN cannot reach the client by accident. Adding a second
// place that picks a status is how the API grows two answers for the same
// failure.
func Fail(c *gin.Context, err error) {
	Error(c, StatusFor(apperr.KindOf(err)), apperr.MessageOf(err))
}

// StatusFor is exported so the mapping is testable as a unit and readable as a
// single table, rather than being spread across handlers.
func StatusFor(k apperr.Kind) int {
	switch k {
	case apperr.KindInvalid:
		return http.StatusBadRequest
	case apperr.KindUnauthorized:
		return http.StatusUnauthorized
	case apperr.KindForbidden:
		return http.StatusForbidden
	case apperr.KindNotFound:
		return http.StatusNotFound
	case apperr.KindConflict:
		return http.StatusConflict
	case apperr.KindInternal:
		return http.StatusInternalServerError
	default:
		return http.StatusInternalServerError
	}
}
