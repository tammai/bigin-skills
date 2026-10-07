package api

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"{{MODULE}}/internal/openapi"
	"{{MODULE}}/internal/shared/httpx"
)

// CreateSession is the browser login. The session ID goes into an HttpOnly
// cookie and nowhere else — not the body, where script could read it — so the
// response carries only the user.
//
// The Origin requirement and the rate limit are not here: both are selectors
// in internal/api/middleware, applied before this handler runs.
func (h *Handlers) CreateSession(c *gin.Context) {
	var body openapi.LoginRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		httpx.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	user, session, err := h.svc.CreateSession(c.Request.Context(), string(body.Email), body.Password)
	if err != nil {
		httpx.Fail(c, err)
		return
	}

	h.cookie.Set(c, session.Raw, session.ExpiresAt)
	httpx.OK(c, http.StatusCreated, openapi.SessionResponse{User: toAPIUser(*user)})
}

// DeleteSession is the browser logout. With no cookie there is nothing to
// delete, which is still a success: the caller wanted to be logged out and is.
//
// The cookie is cleared FIRST and unconditionally — before the error check,
// since headers cannot be added once the error body is written. A browser
// holding a dead cookie drops it, and so does one whose server-side delete
// failed: the user asked to be logged out of this browser, and that half
// should not depend on the database. The failure is still reported.
func (h *Handlers) DeleteSession(c *gin.Context) {
	raw, ok := h.cookie.Read(c)
	h.cookie.Clear(c)

	if ok {
		if err := h.svc.DeleteSession(c.Request.Context(), raw); err != nil {
			httpx.Fail(c, err)
			return
		}
	}

	httpx.OK(c, http.StatusOK, openapi.MessageResponse{Message: "Logged out successfully"})
}
