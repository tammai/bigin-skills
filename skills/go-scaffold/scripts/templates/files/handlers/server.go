package handlers

import (
	openapi_types "github.com/oapi-codegen/runtime/types"

	"{{MODULE}}/api"
	"{{MODULE}}/models"
)

// Server implements api.ServerInterface, the handler interface generated from
// openapi.yaml by oapi-codegen. The contract (openapi.yaml) is the single
// source of truth for routing and request/response types.
var _ api.ServerInterface = (*Server)(nil)

type Server struct{}

// toAPIUser maps a GORM model to the contract's User response type.
func toAPIUser(u models.User) api.User {
	return api.User{
		Id:        int64(u.ID),
		Email:     openapi_types.Email(u.Email),
		FullName:  &u.FullName,
		Role:      u.Role,
		CreatedAt: &u.CreatedAt,
		UpdatedAt: &u.UpdatedAt,
	}
}

func toAPIUserList(users []models.User) []api.User {
	out := make([]api.User, 0, len(users))
	for _, u := range users {
		out = append(out, toAPIUser(u))
	}
	return out
}
