// Package api adapts HTTP to the posts module's application layer (thin handlers,
// ADR §4.2). Errors return (nil, err) and render via apierror's central handler.
package api

import (
	"context"

	"github.com/google/uuid"
	openapi_types "github.com/oapi-codegen/runtime/types"

	"{{MODULE}}/internal/posts/internal/application"
	"{{MODULE}}/internal/posts/internal/domain"
	"{{MODULE}}/internal/posts/internal/gen"
	"{{MODULE}}/internal/shared/apierror"
	"{{MODULE}}/internal/shared/auth"
)

type Handler struct {
	svc *application.Service
}

func NewHandler(svc *application.Service) *Handler {
	return &Handler{svc: svc}
}

var _ gen.StrictServerInterface = (*Handler)(nil)

func toGenPost(p domain.Post, authorName *string) (gen.Post, error) {
	id, err := uuid.Parse(p.ID)
	if err != nil {
		return gen.Post{}, err
	}
	var authorID *openapi_types.UUID
	if p.AuthorID != nil {
		au, err := uuid.Parse(*p.AuthorID)
		if err != nil {
			return gen.Post{}, err
		}
		authorID = &au
	}
	return gen.Post{
		Id:         id,
		AuthorId:   authorID,
		AuthorName: authorName,
		Title:      p.Title,
		Body:       p.Body,
		CreatedAt:  p.CreatedAt,
		Version:    p.Version,
	}, nil
}

func (h *Handler) CreatePost(ctx context.Context, request gen.CreatePostRequestObject) (gen.CreatePostResponseObject, error) {
	principal, err := auth.Require(ctx)
	if err != nil {
		return nil, err
	}
	if request.Body == nil || request.Body.Title == "" || request.Body.Body == "" {
		return nil, apierror.Unprocessable(apierror.CodeValidationFailed, "title and body are required")
	}
	post, err := h.svc.CreatePost(ctx, application.CreatePostInput{Title: request.Body.Title, Body: request.Body.Body}, principal)
	if err != nil {
		return nil, err
	}
	g, err := toGenPost(post, nil)
	if err != nil {
		return nil, err
	}
	return gen.CreatePost201JSONResponse(g), nil
}

func (h *Handler) ListPosts(ctx context.Context, request gen.ListPostsRequestObject) (gen.ListPostsResponseObject, error) {
	principal, err := auth.Require(ctx)
	if err != nil {
		return nil, err
	}
	result, err := h.svc.ListPosts(ctx, application.ListPostsInput{Limit: request.Params.Limit, Offset: request.Params.Offset}, principal)
	if err != nil {
		return nil, err
	}
	data := make([]gen.Post, len(result.Data))
	for i, item := range result.Data {
		g, err := toGenPost(item.Post, item.AuthorName)
		if err != nil {
			return nil, err
		}
		data[i] = g
	}
	return gen.ListPosts200JSONResponse{Data: data, Limit: result.Limit, Offset: result.Offset}, nil
}

func (h *Handler) UpdatePost(ctx context.Context, request gen.UpdatePostRequestObject) (gen.UpdatePostResponseObject, error) {
	principal, err := auth.Require(ctx)
	if err != nil {
		return nil, err
	}
	if request.Body == nil {
		return nil, apierror.Unprocessable(apierror.CodeValidationFailed, "version is required")
	}
	post, err := h.svc.UpdatePost(ctx, request.Id.String(), application.UpdatePostInput{
		Title:   request.Body.Title,
		Body:    request.Body.Body,
		Version: request.Body.Version,
	}, principal)
	if err != nil {
		return nil, err
	}
	g, err := toGenPost(post, nil)
	if err != nil {
		return nil, err
	}
	return gen.UpdatePost200JSONResponse(g), nil
}
