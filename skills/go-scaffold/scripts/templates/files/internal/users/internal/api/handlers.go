// Package api adapts HTTP to the users module's application layer. Handlers are
// THIN (ADR §4.2): parse the request, call the use-case, serialize the response.
// No business rules here — RBAC and credential logic live in application/.
//
// Errors: a handler returns (nil, err); the generated strict server routes it to
// apierror's ResponseErrorHandler, which renders the nested envelope with the
// right status. Handlers only ever construct 2xx responses.
package api

import (
	"context"
	"strings"

	"github.com/google/uuid"
	openapi_types "github.com/oapi-codegen/runtime/types"

	"{{MODULE}}/internal/shared/apierror"
	"{{MODULE}}/internal/shared/auth"
	"{{MODULE}}/internal/users/internal/application"
	"{{MODULE}}/internal/users/internal/domain"
	"{{MODULE}}/internal/users/internal/gen"
)

type Handler struct {
	svc *application.Service
	jwt *auth.JWT
}

func NewHandler(svc *application.Service, jwt *auth.JWT) *Handler {
	return &Handler{svc: svc, jwt: jwt}
}

var _ gen.StrictServerInterface = (*Handler)(nil)

func toGenUser(v domain.View) (gen.User, error) {
	id, err := uuid.Parse(v.ID)
	if err != nil {
		return gen.User{}, err
	}
	return gen.User{Id: id, Email: openapi_types.Email(v.Email), Name: v.Name, CreatedAt: v.CreatedAt}, nil
}

func (h *Handler) issue(p auth.Principal, refreshToken string) (gen.TokenPair, error) {
	access, err := h.jwt.Sign(p.Sub, p.Roles)
	if err != nil {
		return gen.TokenPair{}, err
	}
	return gen.TokenPair{
		AccessToken:  access,
		RefreshToken: refreshToken,
		TokenType:    "Bearer",
		ExpiresIn:    int(h.jwt.AccessTTL().Seconds()),
	}, nil
}

func (h *Handler) CreateUser(ctx context.Context, request gen.CreateUserRequestObject) (gen.CreateUserResponseObject, error) {
	if request.Body == nil {
		return nil, apierror.BadRequest(apierror.CodeValidationFailed, "request body is required")
	}
	name := strings.TrimSpace(request.Body.Name)
	if name == "" || len(request.Body.Password) < 8 {
		return nil, apierror.Unprocessable(apierror.CodeValidationFailed, "name is required and password must be at least 8 characters")
	}
	view, err := h.svc.CreateUser(ctx, application.CreateUserInput{
		Email:    string(request.Body.Email),
		Name:     name,
		Password: request.Body.Password,
	})
	if err != nil {
		return nil, err
	}
	u, err := toGenUser(view)
	if err != nil {
		return nil, err
	}
	return gen.CreateUser201JSONResponse(u), nil
}

func (h *Handler) ListUsers(ctx context.Context, request gen.ListUsersRequestObject) (gen.ListUsersResponseObject, error) {
	principal, err := auth.Require(ctx)
	if err != nil {
		return nil, err
	}
	result, err := h.svc.ListUsers(ctx, application.ListUsersInput{Limit: request.Params.Limit, Offset: request.Params.Offset}, principal)
	if err != nil {
		return nil, err
	}
	data := make([]gen.User, len(result.Data))
	for i, v := range result.Data {
		u, err := toGenUser(v)
		if err != nil {
			return nil, err
		}
		data[i] = u
	}
	return gen.ListUsers200JSONResponse{Data: data, Limit: result.Limit, Offset: result.Offset}, nil
}

func (h *Handler) GetUser(ctx context.Context, request gen.GetUserRequestObject) (gen.GetUserResponseObject, error) {
	principal, err := auth.Require(ctx)
	if err != nil {
		return nil, err
	}
	view, err := h.svc.GetUser(ctx, request.Id.String(), principal)
	if err != nil {
		return nil, err
	}
	if view == nil {
		return nil, apierror.NotFound(apierror.CodeUserNotFound, "user not found")
	}
	u, err := toGenUser(*view)
	if err != nil {
		return nil, err
	}
	return gen.GetUser200JSONResponse(u), nil
}

func (h *Handler) EraseUser(ctx context.Context, request gen.EraseUserRequestObject) (gen.EraseUserResponseObject, error) {
	principal, err := auth.Require(ctx)
	if err != nil {
		return nil, err
	}
	if err := h.svc.EraseUser(ctx, request.Id.String(), principal); err != nil {
		return nil, err
	}
	return gen.EraseUser204Response{}, nil
}

func (h *Handler) Login(ctx context.Context, request gen.LoginRequestObject) (gen.LoginResponseObject, error) {
	if request.Body == nil {
		return nil, apierror.BadRequest(apierror.CodeValidationFailed, "request body is required")
	}
	result, err := h.svc.Login(ctx, string(request.Body.Email), request.Body.Password)
	if err != nil {
		return nil, err
	}
	pair, err := h.issue(result.Principal, result.RefreshToken)
	if err != nil {
		return nil, err
	}
	return gen.Login200JSONResponse(pair), nil
}

func (h *Handler) RefreshToken(ctx context.Context, request gen.RefreshTokenRequestObject) (gen.RefreshTokenResponseObject, error) {
	if request.Body == nil {
		return nil, apierror.BadRequest(apierror.CodeValidationFailed, "request body is required")
	}
	result, err := h.svc.Refresh(ctx, request.Body.RefreshToken)
	if err != nil {
		return nil, err
	}
	pair, err := h.issue(result.Principal, result.RefreshToken)
	if err != nil {
		return nil, err
	}
	return gen.RefreshToken200JSONResponse(pair), nil
}

func (h *Handler) Logout(ctx context.Context, request gen.LogoutRequestObject) (gen.LogoutResponseObject, error) {
	principal, err := auth.Require(ctx)
	if err != nil {
		return nil, err
	}
	if request.Body == nil {
		return nil, apierror.BadRequest(apierror.CodeValidationFailed, "request body is required")
	}
	// Pass the caller's id so Logout only revokes a token that belongs to them.
	if err := h.svc.Logout(ctx, principal.Sub, request.Body.RefreshToken); err != nil {
		return nil, err
	}
	return gen.Logout204Response{}, nil
}
