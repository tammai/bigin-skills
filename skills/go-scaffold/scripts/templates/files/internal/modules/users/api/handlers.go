// Package api is the users module's HTTP surface: one method per operationId
// in openapi.yaml that belongs to this module.
//
// These methods TRANSLATE and nothing else — bind the generated request type,
// call a use case, map the result to the generated response type. Any branch in
// here that is not about the wire format belongs in application or domain; a
// rule that lives in a handler is a rule no other caller can reach and no
// DB-free test can cover.
package api

import (
	"github.com/gin-gonic/gin"
	openapi_types "github.com/oapi-codegen/runtime/types"

	"{{MODULE}}/internal/modules/users/application"
	"{{MODULE}}/internal/modules/users/domain"
	"{{MODULE}}/internal/openapi"
	"{{MODULE}}/internal/shared/apperr"
	"{{MODULE}}/internal/shared/httpx"
)

type Handlers struct {
	svc *application.Service
}

func NewHandlers(svc *application.Service) *Handlers {
	return &Handlers{svc: svc}
}

// toAPIUser maps the domain entity to the contract's response type. It is the
// only place the two shapes meet, which is what lets either change without
// chasing field assignments through the handlers.
func toAPIUser(u domain.User) openapi.User {
	fullName := u.FullName
	createdAt := u.CreatedAt
	updatedAt := u.UpdatedAt
	return openapi.User{
		Id:        int64(u.ID),
		Email:     openapi_types.Email(u.Email),
		FullName:  &fullName,
		Role:      u.Role,
		CreatedAt: &createdAt,
		UpdatedAt: &updatedAt,
	}
}

func toAPIUsers(users []domain.User) []openapi.User {
	out := make([]openapi.User, 0, len(users))
	for _, u := range users {
		out = append(out, toAPIUser(u))
	}
	return out
}

// callerID returns the authenticated user's ID, or reports that the request
// arrived without a verified identity.
//
// A handler reaching this branch means a protected route has no selector case
// in internal/api/middleware — so it answers 401 rather than treating the zero
// value as a real user ID.
func callerID(c *gin.Context) (uint, bool) {
	claims, ok := httpx.ClaimsFrom(c)
	if !ok {
		httpx.Fail(c, apperr.Unauthorized("Unauthorized"))
		return 0, false
	}
	return claims.UserID, true
}
