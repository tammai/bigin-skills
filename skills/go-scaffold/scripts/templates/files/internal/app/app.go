// Package app is the composition root (ADR §4.1). It is intentionally OUTSIDE
// the module boundary — it may reach into every module's public surface to wire
// the app together. It builds the shared kernel (auth), constructs each module,
// injects the cross-module dependencies, and mounts routes + global middleware.
//
// The two modules depend on each other's public interfaces (users needs posts'
// AnonymizeAuthor for erase; posts needs users' GetManyByIDs for author names).
// Neither imports the other — each depends on an interface it defines, and this
// root supplies the concrete implementation. Constructed here: usersMod first
// (posts needs it as UserDirectory), then postsMod, then the reverse edge wired
// via usersMod.UsePosts — no import cycle, no package-level circular dependency.
package app

import (
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/go-chi/httprate"
	"github.com/jackc/pgx/v5/pgxpool"

	"{{MODULE}}/internal/posts"
	"{{MODULE}}/internal/shared/auth"
	"{{MODULE}}/internal/shared/config"
	"{{MODULE}}/internal/users"
)

// Build assembles the HTTP handler. openapiSpec is the raw api/openapi.yaml bytes
// (served at /openapi.yaml); pass nil to skip the spec/docs routes.
func Build(pool *pgxpool.Pool, cfg config.Config, logger *slog.Logger, openapiSpec []byte) http.Handler {
	hasher := auth.NewArgon2Hasher(cfg.Argon2Memory, cfg.Argon2Time, cfg.Argon2Parallelism)
	jwt := auth.NewJWT(cfg.JWTSecret, cfg.JWTAccessTTL)

	usersMod := users.New(pool, jwt, hasher, cfg, logger)
	postsMod := posts.New(pool, usersMod, logger) // usersMod satisfies posts.UserDirectory
	usersMod.UsePosts(postsMod)                    // postsMod satisfies users.PostAnonymizer

	r := chi.NewRouter()

	r.Use(middleware.RequestID)
	// Proxy-agnostic client IP (this server is assumed to sit directly on the
	// internet). Behind ALB/nginx/Cloudflare, swap for
	// middleware.ClientIPFromXFF("<trusted-proxy-CIDR>") — see README.
	r.Use(middleware.ClientIPFromRemoteAddr)
	r.Use(requestLogger(logger))
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(30 * time.Second))
	r.Use(middleware.Compress(5))
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   cfg.CORSOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// Health/spec routes live OUTSIDE the rate-limited group (ADR §9.5): a load
	// balancer polls /healthz and /readyz every few seconds, and counting them
	// against the shared per-IP budget would starve real traffic's allowance.
	r.Get("/healthz", handleLiveness)
	r.Get("/readyz", handleReadiness(pool))
	if len(openapiSpec) > 0 {
		r.Get("/openapi.yaml", handleOpenAPISpec(openapiSpec))
		r.Get("/docs", handleDocsUI)
	}

	// Rate-limited + auth-parsed API surface. auth.Middleware only PARSES a bearer
	// token into the context (it never rejects) — public routes (signup, login,
	// refresh) stay reachable; protected handlers call auth.Require themselves.
	r.Group(func(r chi.Router) {
		// Key the limit off the resolved client IP (set by ClientIPFromRemoteAddr
		// above). CanonicalizeIP buckets IPv6 by /64. Behind a trusted proxy, swap
		// ClientIPFromRemoteAddr for ClientIPFromXFF and this keys off the real IP.
		r.Use(httprate.LimitBy(100, time.Minute, func(req *http.Request) (string, error) {
			return httprate.CanonicalizeIP(middleware.GetClientIP(req.Context())), nil
		}))
		r.Use(auth.Middleware(jwt))
		usersMod.Register(r)
		postsMod.Register(r)
	})

	return r
}
