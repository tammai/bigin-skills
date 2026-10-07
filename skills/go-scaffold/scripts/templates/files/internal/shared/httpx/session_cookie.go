package httpx

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// SessionCookie is the one definition of the browser-session cookie, shared by
// the handler that sets it and the middleware that reads it — two copies of
// the name or the flags would let them disagree, and the symptom (login
// succeeds, the next request is anonymous) points nowhere near the cause.
//
// Name and Secure come from config: "__Host-session" + Secure in every real
// deployment, "session" without Secure only in plain-HTTP development.
type SessionCookie struct {
	Name   string
	Secure bool
}

// Set issues the cookie with Max-Age reaching the session's absolute expiry.
// It is set once, at login, and never re-issued: sliding the idle window is a
// server-side update, so the browser's copy only needs to outlive the session.
func (s SessionCookie) Set(c *gin.Context, value string, expiresAt time.Time) {
	// Rounded, not truncated: the expiry was computed a moment ago, so the
	// raw remainder is a hair under the configured lifetime.
	http.SetCookie(c.Writer, s.cookie(value, int(time.Until(expiresAt).Round(time.Second).Seconds())))
}

// Clear tells the browser to drop the cookie (Max-Age=0 on the wire).
func (s SessionCookie) Clear(c *gin.Context) {
	http.SetCookie(c.Writer, s.cookie("", -1))
}

// Read returns the cookie's value, or false when the request carries none.
// Only this exact name counts: a secure deployment ignores a bare "session"
// cookie, which a plain-HTTP response or a sibling subdomain could plant.
func (s SessionCookie) Read(c *gin.Context) (string, bool) {
	v, err := c.Cookie(s.Name)
	if err != nil || v == "" {
		return "", false
	}
	return v, true
}

// cookie fixes every attribute in one place. Path=/ with no Domain is what the
// __Host- prefix requires; HttpOnly keeps script from reading the ID;
// SameSite=Lax keeps cross-site POSTs from carrying it — the first CSRF layer,
// with the Origin allowlist in internal/api/middleware as the second.
func (s SessionCookie) cookie(value string, maxAge int) *http.Cookie {
	return &http.Cookie{
		Name:     s.Name,
		Value:    value,
		Path:     "/",
		MaxAge:   maxAge,
		HttpOnly: true,
		Secure:   s.Secure,
		SameSite: http.SameSiteLaxMode,
	}
}
