package api

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"

	"{{MODULE}}/internal/modules/users/application"
	"{{MODULE}}/internal/modules/users/domain"
	"{{MODULE}}/internal/shared/apperr"
	"{{MODULE}}/internal/shared/auth"
	"{{MODULE}}/internal/shared/httpx"
)

// brokenSessions fails every write, which is the one branch of DeleteSession
// a database-free router test cannot reach.
type brokenSessions struct{}

func (brokenSessions) Create(context.Context, *domain.Session) error { return errBroken }
func (brokenSessions) ByHash(context.Context, string) (*domain.Session, error) {
	return nil, errBroken
}
func (brokenSessions) UpdateActivity(context.Context, *domain.Session) error { return errBroken }
func (brokenSessions) Delete(context.Context, string) error                  { return errBroken }
func (brokenSessions) DeleteExpiredForUser(context.Context, uint, time.Time) error {
	return errBroken
}

var errBroken = apperr.Internal("Failed to delete session", errors.New("pq: connection refused"))

// The server failing to delete the row is no reason for the browser to keep
// the cookie: the user asked to be logged out of THIS browser, and dropping
// the cookie does that even while the row lingers. The error status still
// reports that the server-side half did not happen.
func TestDeleteSessionClearsTheCookieEvenWhenTheDeleteFails(t *testing.T) {
	gin.SetMode(gin.TestMode)
	cookie := httpx.SessionCookie{Name: "__Host-session", Secure: true}
	issuer := auth.NewTokenIssuer([]byte("test-secret"), 15*time.Minute, 7*24*time.Hour)
	svc := application.NewService(nil, nil, brokenSessions{}, issuer,
		domain.SessionPolicy{IdleTTL: 72 * time.Hour, AbsoluteTTL: 30 * 24 * time.Hour})
	h := NewHandlers(svc, cookie)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodDelete, "/api/v1/auth/session", nil)
	c.Request.Header.Set("Cookie", "__Host-session=abc")
	h.DeleteSession(c)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("status = %d, want 500 — the failed delete must still be reported", w.Code)
	}
	if got := w.Header().Get("Set-Cookie"); !strings.Contains(got, "__Host-session=;") || !strings.Contains(got, "Max-Age=0") {
		t.Errorf("Set-Cookie = %q, want the session cookie cleared", got)
	}
}
