package api

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"{{MODULE}}/internal/openapi"
	"{{MODULE}}/internal/shared/httpx"
)

// ListUsers passes the raw query values through; clamping lives in the use
// case, where it is testable and applies to every caller. Zero here means
// "unset", which ListUsers turns into the documented default.
func (h *Handlers) ListUsers(c *gin.Context, params openapi.ListUsersParams) {
	page, limit := 0, 0
	if params.Page != nil {
		page = *params.Page
	}
	if params.Limit != nil {
		limit = *params.Limit
	}

	result, err := h.svc.ListUsers(c.Request.Context(), page, limit)
	if err != nil {
		httpx.Fail(c, err)
		return
	}

	httpx.OK(c, http.StatusOK, openapi.UserListResponse{
		Data:  toAPIUsers(result.Users),
		Page:  result.Page,
		Limit: result.Limit,
		Total: result.Total,
	})
}

func (h *Handlers) UpdateUserRole(c *gin.Context, id int) {
	var body openapi.UpdateRoleRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		httpx.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	requesterID, ok := callerID(c)
	if !ok {
		return
	}

	user, err := h.svc.ChangeRole(c.Request.Context(), requesterID, uint(id), string(body.Role))
	if err != nil {
		httpx.Fail(c, err)
		return
	}

	httpx.OK(c, http.StatusOK, toAPIUser(*user))
}

func (h *Handlers) DeleteUser(c *gin.Context, id int) {
	requesterID, ok := callerID(c)
	if !ok {
		return
	}

	if err := h.svc.DeleteUser(c.Request.Context(), requesterID, uint(id)); err != nil {
		httpx.Fail(c, err)
		return
	}

	httpx.OK(c, http.StatusOK, openapi.MessageResponse{Message: "User deleted successfully"})
}
