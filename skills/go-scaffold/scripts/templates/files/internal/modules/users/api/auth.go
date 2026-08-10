package api

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"{{MODULE}}/internal/modules/users/application"
	"{{MODULE}}/internal/openapi"
	"{{MODULE}}/internal/shared/httpx"
)

// SignUp registers a new user.
//
// The binding tags on openapi.SignUpRequest (required, email, min, notags) come
// from x-oapi-codegen-extra-tags in the contract — the spec decides what a valid
// payload is, so there is no hand-written re-validation here.
func (h *Handlers) SignUp(c *gin.Context) {
	var body openapi.SignUpRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		// A binding error is the one error text safe to echo: it describes the
		// caller's own payload and nothing about the server.
		httpx.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	user, err := h.svc.SignUp(c.Request.Context(), application.SignUpInput{
		Email:    string(body.Email),
		Password: body.Password,
		FullName: body.FullName,
	})
	if err != nil {
		httpx.Fail(c, err)
		return
	}

	httpx.OK(c, http.StatusCreated, toAPIUser(*user))
}

func (h *Handlers) Login(c *gin.Context) {
	var body openapi.LoginRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		httpx.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	user, tokens, err := h.svc.Login(c.Request.Context(), string(body.Email), body.Password)
	if err != nil {
		httpx.Fail(c, err)
		return
	}

	httpx.OK(c, http.StatusOK, openapi.LoginResponse{
		AccessToken:  tokens.Access,
		RefreshToken: tokens.Refresh,
		User:         toAPIUser(*user),
	})
}

func (h *Handlers) Refresh(c *gin.Context) {
	var body openapi.RefreshRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		httpx.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	tokens, err := h.svc.Refresh(c.Request.Context(), body.RefreshToken)
	if err != nil {
		httpx.Fail(c, err)
		return
	}

	httpx.OK(c, http.StatusOK, openapi.TokenResponse{
		AccessToken:  tokens.Access,
		RefreshToken: tokens.Refresh,
	})
}

func (h *Handlers) Logout(c *gin.Context) {
	var body openapi.LogoutRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		httpx.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	if err := h.svc.Logout(c.Request.Context(), body.RefreshToken); err != nil {
		httpx.Fail(c, err)
		return
	}

	httpx.OK(c, http.StatusOK, openapi.MessageResponse{Message: "Logged out successfully"})
}
