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

func cleanupVisitors() {
	for {
		time.Sleep(time.Minute)
		mu.Lock()
		for ip, v := range visitors {
			if time.Since(v.lastSeen) > 3*time.Minute {
				delete(visitors, ip)
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

// RateLimit(name, 5, 5) = max 5 requests/minute, burst 5, per route.
// name prefixes the key, so login and signup (and any other routes) each get
// their own limiter and do NOT share a budget.
// NOTE: in-memory limiter, only correct when running a single instance.
// When scaling to multiple pods/instances, switch to a Redis-backed limiter.
func RateLimit(name string, requestsPerMinute int, burst int) gin.HandlerFunc {
	r := rate.Every(time.Minute / time.Duration(requestsPerMinute))
	return func(c *gin.Context) {
		key := name + ":" + c.ClientIP()
		limiter := getVisitor(key, r, burst)
		if !limiter.Allow() {
			c.JSON(http.StatusTooManyRequests, gin.H{"error": "Too many requests, please try again later"})
			c.Abort()
			return
		}
		c.Next()
	}
}
