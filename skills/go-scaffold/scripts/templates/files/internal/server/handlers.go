package server

import (
	"context"
	"errors"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	openapi_types "github.com/oapi-codegen/runtime/types"

	"{{MODULE}}/internal/api"
	"{{MODULE}}/internal/store"
)

func (s *Server) GetUser(ctx context.Context, request api.GetUserRequestObject) (api.GetUserResponseObject, error) {
	user, err := s.store.GetUser(ctx, pgtype.UUID{Bytes: request.Id, Valid: true})
	if errors.Is(err, pgx.ErrNoRows) {
		return api.GetUser404JSONResponse{Code: "not_found", Message: "user not found"}, nil
	}
	if err != nil {
		return nil, err
	}
	return api.GetUser200JSONResponse(toAPIUser(user)), nil
}

func (s *Server) CreateUser(ctx context.Context, request api.CreateUserRequestObject) (api.CreateUserResponseObject, error) {
	if request.Body == nil {
		return api.CreateUser400JSONResponse{Code: "invalid_request", Message: "request body is required"}, nil
	}
	name := strings.TrimSpace(request.Body.Name)
	if name == "" {
		return api.CreateUser400JSONResponse{Code: "invalid_request", Message: "name is required"}, nil
	}

	user, err := s.store.CreateUser(ctx, store.CreateUserParams{
		Email: string(request.Body.Email),
		Name:  name,
	})
	if err != nil {
		return nil, err
	}
	return api.CreateUser201JSONResponse(toAPIUser(user)), nil
}

func toAPIUser(u store.User) api.User {
	return api.User{
		Id:        openapi_types.UUID(u.ID.Bytes),
		Email:     openapi_types.Email(u.Email),
		Name:      u.Name,
		CreatedAt: u.CreatedAt.Time,
	}
}
