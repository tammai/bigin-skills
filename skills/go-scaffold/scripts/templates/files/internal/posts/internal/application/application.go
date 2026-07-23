// Package application holds the posts module's use-cases (ADR §4.2). Depends on
// repository + cross-module INTERFACES defined here; infrastructure implements
// the repo, the composition root supplies the user directory.
package application

import (
	"context"

	"{{MODULE}}/internal/posts/internal/domain"
)

// PostsRepo is the posts-table persistence seam.
type PostsRepo interface {
	Create(ctx context.Context, p CreatePostParams) (domain.Post, error)
	FindByID(ctx context.Context, id string) (*domain.Post, error)
	List(ctx context.Context, limit, offset int) ([]domain.Post, error)
	// UpdateWithVersion returns nil (no error) when no live row matched the
	// expected version — the optimistic-concurrency miss the use-case maps to 409.
	UpdateWithVersion(ctx context.Context, p UpdatePostParams) (*domain.Post, error)
	AnonymizeAuthor(ctx context.Context, authorID string) error
}

// UserDirectory is the cross-module read-composition dependency (users satisfies
// it). Defined here on the CONSUMER side so posts never imports the users module
// (ADR §4.2). Returns id→name.
type UserDirectory interface {
	GetManyByIDs(ctx context.Context, ids []string) (map[string]string, error)
}

type CreatePostParams struct {
	Title    string
	Body     string
	AuthorID string
}

type UpdatePostParams struct {
	ID              string
	ExpectedVersion int
	Title           *string
	Body            *string
	UpdatedBy       string
}

type Service struct {
	posts PostsRepo
	users UserDirectory
}

func NewService(posts PostsRepo, users UserDirectory) *Service {
	return &Service{posts: posts, users: users}
}
