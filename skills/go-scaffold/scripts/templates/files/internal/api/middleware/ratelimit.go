package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/time/rate"
)

type visitor struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

var (
	visitors = make(map[string]*visitor)
	mu       sync.Mutex
)

// Entries are evicted after a period of inactivity; without this the map grows
// once per unique IP and never shrinks, which is a slow memory leak on any
// public endpoint.
func cleanupVisitors() {
	for {
		time.Sleep(time.Minute)
		mu.Lock()
		for key, v := range visitors {
			if time.Since(v.lastSeen) > 3*time.Minute {
				delete(visitors, key)
			}
		}
		mu.Unlock()
	}
}

func init() {
	go cleanupVisitors()
}

func getVisitor(key string, r rate.Limit, b int) *rate.Limiter {
	mu.Lock()
	defer mu.Unlock()

	v, exists := visitors[key]
	if !exists {
		limiter := rate.NewLimiter(r, b)
		visitors[key] = &visitor{limiter: limiter, lastSeen: time.Now()}
		return limiter
	}
	v.lastSeen = time.Now()
	return v.limiter
}

// RateLimit("login", 5, 5) allows 5 requests per minute with a burst of 5, per
// client IP. The name prefixes the key, so each route keeps an independent
// budget instead of sharing one.
//
// NOTE: the state is in-memory, so the limit is per process. With more than one
// replica each gets its own allowance — swap in a shared store (Redis) before
// scaling out, or the effective limit silently multiplies by the replica count.
func RateLimit(name string, requestsPerMinute int, burst int) gin.HandlerFunc {
	r := rate.Every(time.Minute / time.Duration(requestsPerMinute))
	return func(c *gin.Context) {
		limiter := getVisitor(name+":"+c.ClientIP(), r, burst)
		if !limiter.Allow() {
			abort(c, http.StatusTooManyRequests, "Too many requests, please try again later")
			return
		}
		c.Next()
	}
}
