package middleware

import (
	"net/netip"

	"github.com/gin-gonic/gin"
)

// CloudflareIPHeader is the header Cloudflare sets to the connecting client's
// address, overwriting any value the client sent.
const CloudflareIPHeader = "CF-Connecting-IP"

// CloudflareClientIP makes the header safe for gin to read as the client IP.
// Gin's TrustedPlatform returns the raw header with no validation, so this runs
// first and leaves the header either as one canonical IP address or deleted —
// and a deleted header makes ClientIP() fall back to the TCP peer.
//
// Anything that is not exactly one plain IP is dropped: a comma list, a second
// header line, an IPv6 zone, garbage. A forged value can therefore never become
// an arbitrary string in a rate-limit key or a log line.
//
// Only use this when the origin is reachable solely through Cloudflare;
// otherwise any caller can set the header themselves.
func CloudflareClientIP() gin.HandlerFunc {
	return func(c *gin.Context) {
		values := c.Request.Header.Values(CloudflareIPHeader)
		if len(values) != 1 {
			c.Request.Header.Del(CloudflareIPHeader)
			c.Next()
			return
		}
		addr, err := netip.ParseAddr(values[0])
		if err != nil || addr.Zone() != "" {
			c.Request.Header.Del(CloudflareIPHeader)
			c.Next()
			return
		}
		// Unmap so ::ffff:1.2.3.4 and 1.2.3.4 share one bucket.
		c.Request.Header.Set(CloudflareIPHeader, addr.Unmap().String())
		c.Next()
	}
}
