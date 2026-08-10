package api

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"{{MODULE}}/internal/openapi"
	"{{MODULE}}/internal/shared/httpx"
)

// GetProfile returns the caller's own record. The ID comes from the verified
// token, never from the request — which is why there is no :id in this route.
func (h *Handlers) GetProfile(c *gin.Context) {
	userID, ok := callerID(c)
	if !ok {
		return
	}

	user, err := h.svc.Profile(c.Request.Context(), userID)
	if err != nil {
		httpx.Fail(c, err)
		return
	}

	httpx.OK(c, http.StatusOK, toAPIUser(*user))
}

func (h *Handlers) UpdateProfile(c *gin.Context) {
	var body openapi.UpdateProfileRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		httpx.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	userID, ok := callerID(c)
	if !ok {
		return
	}

	// body.FullName stays a pointer all the way down: nil means the client
	// omitted the field, which the use case treats differently from an empty
	// string.
	user, err := h.svc.UpdateProfile(c.Request.Context(), userID, body.FullName)
	if err != nil {
		httpx.Fail(c, err)
		return
	}

	httpx.OK(c, http.StatusOK, toAPIUser(*user))
}
