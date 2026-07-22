package apierror

import (
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5/middleware"
)

func discardLogger() *slog.Logger { return slog.New(slog.NewTextHandler(io.Discard, nil)) }

// serve runs fn wrapped in middleware.RequestID (as in production) so a
// request_id is bound into the context, and returns the recorded response.
func serve(fn http.HandlerFunc) *httptest.ResponseRecorder {
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/thing", nil)
	middleware.RequestID(fn).ServeHTTP(rec, req)
	return rec
}

func decodeEnvelope(t *testing.T, rec *httptest.ResponseRecorder) map[string]any {
	t.Helper()
	var body map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("response body is not JSON: %v (%q)", err, rec.Body.String())
	}
	errObj, ok := body["error"].(map[string]any)
	if !ok {
		t.Fatalf("body has no nested `error` object: %v", body)
	}
	return errObj
}

func TestWriteRendersNestedEnvelope(t *testing.T) {
	appErr := New(http.StatusUnprocessableEntity, CodeValidationFailed, "bad input",
		Detail{Field: "email", Message: "required"})
	rec := serve(func(w http.ResponseWriter, r *http.Request) { Write(w, r, discardLogger(), appErr) })

	if rec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("status = %d, want 422", rec.Code)
	}
	if ct := rec.Header().Get("Content-Type"); ct != "application/json" {
		t.Fatalf("content-type = %q, want application/json", ct)
	}
	errObj := decodeEnvelope(t, rec)
	if errObj["code"] != CodeValidationFailed {
		t.Fatalf("code = %v, want %s", errObj["code"], CodeValidationFailed)
	}
	if errObj["message"] != "bad input" {
		t.Fatalf("message = %v, want %q", errObj["message"], "bad input")
	}
	reqID, present := errObj["request_id"]
	if !present {
		t.Fatal("request_id field must always be present")
	}
	if reqID == "" {
		t.Fatal("request_id must be populated from the request context")
	}
	details, ok := errObj["details"].([]any)
	if !ok || len(details) != 1 {
		t.Fatalf("details = %v, want exactly one entry", errObj["details"])
	}
	d0, _ := details[0].(map[string]any)
	if d0["field"] != "email" || d0["message"] != "required" {
		t.Fatalf("detail[0] = %v, want {field:email, message:required}", d0)
	}
}

func TestWriteOmitsEmptyDetails(t *testing.T) {
	rec := serve(func(w http.ResponseWriter, r *http.Request) {
		Write(w, r, discardLogger(), NotFound(CodeUserNotFound, "user not found"))
	})
	errObj := decodeEnvelope(t, rec)
	if _, present := errObj["details"]; present {
		t.Fatalf("details must be omitted when empty, got %v", errObj["details"])
	}
}

func TestWriteHidesInternalErrorText(t *testing.T) {
	secret := `pq: password authentication failed for user "admin"`
	rec := serve(func(w http.ResponseWriter, r *http.Request) {
		Write(w, r, discardLogger(), errors.New(secret))
	})
	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500", rec.Code)
	}
	if strings.Contains(rec.Body.String(), secret) {
		t.Fatalf("raw internal error text leaked to the client: %s", rec.Body.String())
	}
	errObj := decodeEnvelope(t, rec)
	if errObj["code"] != CodeInternal {
		t.Fatalf("code = %v, want %s", errObj["code"], CodeInternal)
	}
	if errObj["message"] != "internal server error" {
		t.Fatalf("message = %v, want a generic message", errObj["message"])
	}
}

func TestStrictHandlers(t *testing.T) {
	reqErr, respErr := StrictHandlers(discardLogger())
	if reqErr == nil || respErr == nil {
		t.Fatal("StrictHandlers must return two non-nil hooks")
	}

	t.Run("request error maps to a 400 validation envelope without leaking the parser text", func(t *testing.T) {
		rec := serve(func(w http.ResponseWriter, r *http.Request) {
			reqErr(w, r, errors.New("json: cannot unmarshal number into Go struct field"))
		})
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want 400", rec.Code)
		}
		errObj := decodeEnvelope(t, rec)
		if errObj["code"] != CodeValidationFailed {
			t.Fatalf("code = %v, want %s", errObj["code"], CodeValidationFailed)
		}
		if strings.Contains(rec.Body.String(), "cannot unmarshal") {
			t.Fatalf("binding error text leaked: %s", rec.Body.String())
		}
	})

	t.Run("response error routes an AppError through Write with its real status", func(t *testing.T) {
		rec := serve(func(w http.ResponseWriter, r *http.Request) {
			respErr(w, r, Conflict(CodePostVersionConflict, "stale write"))
		})
		if rec.Code != http.StatusConflict {
			t.Fatalf("status = %d, want 409", rec.Code)
		}
		errObj := decodeEnvelope(t, rec)
		if errObj["code"] != CodePostVersionConflict {
			t.Fatalf("code = %v, want %s", errObj["code"], CodePostVersionConflict)
		}
	})
}
