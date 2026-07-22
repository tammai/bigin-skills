package apierror

import (
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5/middleware"
)

// envelope is the wire shape of the fixed error contract (ADR §9.1). It is
// written as raw JSON here rather than via any module's generated Error type, so
// the shared handler stays module-agnostic (each module's oapi-codegen output
// has its own copy of the Error model, but they're structurally identical).
type envelope struct {
	Error envelopeBody `json:"error"`
}

type envelopeBody struct {
	Code      string   `json:"code"`
	Message   string   `json:"message"`
	RequestID string   `json:"request_id"`
	Details   []Detail `json:"details,omitempty"`
}

// Write renders any error into the nested envelope with the request's id. A
// non-AppError is logged in full and surfaced as a generic 500 — internal
// details (SQL errors, stack text) never reach the client's `message`.
func Write(w http.ResponseWriter, r *http.Request, logger *slog.Logger, err error) {
	requestID := middleware.GetReqID(r.Context())

	if ae, ok := As(err); ok {
		if ae.Status >= 500 {
			logger.Error("app error", "path", r.URL.Path, "code", ae.Code, "error", err)
		} else {
			logger.Warn("app error", "path", r.URL.Path, "code", ae.Code, "error", err)
		}
		writeJSON(w, ae.Status, envelope{envelopeBody{ae.Code, ae.Message, requestID, ae.Details}})
		return
	}

	logger.Error("unhandled error", "path", r.URL.Path, "error", err)
	writeJSON(w, http.StatusInternalServerError, envelope{envelopeBody{CodeInternal, "internal server error", requestID, nil}})
}

func writeJSON(w http.ResponseWriter, status int, body envelope) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

// StrictHandlers returns the two error hooks every module wires into its
// generated strict server (RequestErrorHandlerFunc + ResponseErrorHandlerFunc).
// Request-binding failures (bad JSON body, unparseable path/query params) map to
// a 400 validation envelope; handler-returned errors go through Write, so an
// *AppError returned from a use-case gets its real status + code.
func StrictHandlers(logger *slog.Logger) (requestErr, responseErr func(http.ResponseWriter, *http.Request, error)) {
	requestErr = func(w http.ResponseWriter, r *http.Request, err error) {
		requestID := middleware.GetReqID(r.Context())
		logger.Warn("request error", "path", r.URL.Path, "error", err)
		writeJSON(w, http.StatusBadRequest, envelope{envelopeBody{CodeValidationFailed, "request validation failed", requestID, nil}})
	}
	responseErr = func(w http.ResponseWriter, r *http.Request, err error) {
		Write(w, r, logger, err)
	}
	return requestErr, responseErr
}
