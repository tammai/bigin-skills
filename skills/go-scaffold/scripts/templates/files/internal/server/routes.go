package server

import (
	"context"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/go-chi/httprate"
	"github.com/prometheus/client_golang/prometheus/promhttp"

	"{{MODULE}}/internal/api"
)

func (s *Server) Routes() http.Handler {
	r := chi.NewRouter()

	r.Use(middleware.RequestID)
	// This server is assumed to sit directly on the internet with no reverse
	// proxy in front. If you put one in front (ALB, nginx, Cloudflare), swap
	// this for middleware.ClientIPFromXFF("<trusted-proxy-CIDR>") — trusting
	// X-Forwarded-For without a known proxy lets clients spoof their
	// rate-limit bucket.
	r.Use(middleware.ClientIPFromRemoteAddr)
	r.Use(s.requestLogger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(30 * time.Second))
	r.Use(middleware.Compress(5))
	r.Use(httprate.LimitBy(100, time.Minute, func(r *http.Request) (string, error) {
		return httprate.CanonicalizeIP(middleware.GetClientIP(r.Context())), nil
	}))
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   s.cfg.CORSOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	r.Get("/healthz", s.handleLiveness)
	r.Get("/readyz", s.handleReadiness)
	r.Get("/openapi.yaml", s.handleOpenAPISpec)
	r.Get("/docs", s.handleDocsUI)
	r.Handle("/metrics", promhttp.Handler())

	r.Route("/api/v1", func(r chi.Router) {
		r.Use(s.authMiddleware)
		strict := api.NewStrictHandlerWithOptions(s, nil, api.StrictHTTPServerOptions{
			RequestErrorHandlerFunc:  s.handleRequestError,
			ResponseErrorHandlerFunc: s.handleResponseError,
		})
		// HandlerFromMux would use its own default ErrorHandlerFunc (leaks
		// err.Error() to the client) for path/query param binding errors —
		// that's a separate error path from the strict handler's, which only
		// covers JSON body decoding. Route both through the same handler.
		api.HandlerWithOptions(strict, api.ChiServerOptions{
			BaseRouter:       r,
			ErrorHandlerFunc: s.handleRequestError,
		})
	})

	return r
}

func (s *Server) handleLiveness(w http.ResponseWriter, _ *http.Request) {
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("ok"))
}

func (s *Server) handleReadiness(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()
	if s.pool == nil || s.pool.Ping(ctx) != nil {
		w.WriteHeader(http.StatusServiceUnavailable)
		_, _ = w.Write([]byte("db unavailable"))
		return
	}
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("ready"))
}

func (s *Server) handleOpenAPISpec(w http.ResponseWriter, r *http.Request) {
	if len(s.openapiSpec) == 0 {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Content-Type", "application/yaml")
	_, _ = w.Write(s.openapiSpec)
}

func (s *Server) handleDocsUI(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, _ = w.Write([]byte(docsHTML))
}

const docsHTML = `<!doctype html>
<html>
  <head>
    <title>API Docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      window.onload = () => {
        window.ui = SwaggerUIBundle({ url: '/openapi.yaml', dom_id: '#swagger-ui' })
      }
    </script>
  </body>
</html>`
