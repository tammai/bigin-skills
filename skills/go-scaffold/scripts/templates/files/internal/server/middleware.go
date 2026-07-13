package server

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5/middleware"

	"{{MODULE}}/internal/api"
)

func (s *Server) requestLogger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)
		next.ServeHTTP(ww, r)
		s.logger.Info("request",
			"method", r.Method,
			"path", r.URL.Path,
			"status", ww.Status(),
			"bytes", ww.BytesWritten(),
			"duration_ms", time.Since(start).Milliseconds(),
			"request_id", middleware.GetReqID(r.Context()),
			"client_ip", middleware.GetClientIP(r.Context()),
		)
	})
}

// authMiddleware is a pass-through stub — wire real auth (JWT/session
// validation) here before this API takes production traffic.
func (s *Server) authMiddleware(next http.Handler) http.Handler {
	return next
}

// handleRequestError responds to malformed requests (bad JSON, bad params)
// caught by the generated strict handler before it reaches our own code.
func (s *Server) handleRequestError(w http.ResponseWriter, r *http.Request, err error) {
	s.logger.Warn("request error", "path", r.URL.Path, "error", err)
	respondJSONError(w, http.StatusBadRequest, "bad_request", "invalid request")
}

// handleResponseError responds to unhandled errors from our own handlers —
// never echo err.Error() to the client, it may leak internal details.
func (s *Server) handleResponseError(w http.ResponseWriter, r *http.Request, err error) {
	s.logger.Error("response error", "path", r.URL.Path, "error", err)
	respondJSONError(w, http.StatusInternalServerError, "internal_error", "internal server error")
}

func respondJSONError(w http.ResponseWriter, status int, code, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(api.Error{Code: code, Message: message})
}
