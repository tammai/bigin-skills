package httpx

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"

	"{{MODULE}}/internal/shared/apperr"
	"{{MODULE}}/internal/shared/auth"
)

func TestStatusFor(t *testing.T) {
	cases := map[apperr.Kind]int{
		apperr.KindInvalid:      http.StatusBadRequest,
		apperr.KindUnauthorized: http.StatusUnauthorized,
		apperr.KindForbidden:    http.StatusForbidden,
		apperr.KindNotFound:     http.StatusNotFound,
		apperr.KindConflict:     http.StatusConflict,
		apperr.KindInternal:     http.StatusInternalServerError,
	}
	for kind, want := range cases {
		if got := StatusFor(kind); got != want {
			t.Errorf("StatusFor(%v) = %d, want %d", kind, got, want)
		}
	}
}

// The end-to-end leak check: an unclassified error must reach the client as a
// fixed 500 message, with none of the driver's text in the body.
func TestFailDoesNotLeakUnclassifiedErrors(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)

	Fail(c, errors.New(`pq: relation "users" does not exist (host=db user=admin)`))

	if w.Code != http.StatusInternalServerError {
		t.Errorf("status = %d, want 500", w.Code)
	}
	body := w.Body.String()
	if strings.Contains(body, "pq:") || strings.Contains(body, "host=db") {
		t.Errorf("the driver error leaked into the response body: %s", body)
	}

	var decoded map[string]string
	if err := json.Unmarshal(w.Body.Bytes(), &decoded); err != nil {
		t.Fatalf("response is not the {\"error\": ...} shape: %v", err)
	}
	if decoded["error"] != "Internal server error" {
		t.Errorf("error = %q, want the fixed message", decoded["error"])
	}
}

func TestFailMapsTypedErrors(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)

	Fail(c, apperr.Conflict("Email already registered"))

	if w.Code != http.StatusConflict {
		t.Errorf("status = %d, want 409", w.Code)
	}
	if !strings.Contains(w.Body.String(), "Email already registered") {
		t.Errorf("body = %s, want the typed error's message", w.Body.String())
	}
}

// A handler must be able to tell "no identity" from "user 0". Reading a
// zero-valued identity as a real one is how an unauthenticated request ends up
// acting as whichever user owns ID 0.
func TestClaimsFromReportsAbsence(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)

	if _, ok := ClaimsFrom(c); ok {
		t.Fatal("ClaimsFrom reported an identity on a context that never had one")
	}

	SetClaims(c, auth.Claims{UserID: 7, Role: auth.RoleAdmin})
	claims, ok := ClaimsFrom(c)
	if !ok {
		t.Fatal("ClaimsFrom did not return the identity that was set")
	}
	if claims.UserID != 7 || claims.Role != auth.RoleAdmin {
		t.Errorf("claims = %+v, want {7 admin}", claims)
	}
}
