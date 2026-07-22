// Package infrastructure implements the posts module's application ports with
// pgx/v5 + sqlc-generated queries.
package infrastructure

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"{{MODULE}}/internal/posts/internal/application"
	"{{MODULE}}/internal/posts/internal/domain"
	"{{MODULE}}/internal/posts/internal/infrastructure/db"
	"{{MODULE}}/internal/shared/pgconv"
)

type Repository struct {
	q *db.Queries
}

func New(pool *pgxpool.Pool) *Repository {
	return &Repository{q: db.New(pool)}
}

func toPost(r db.PostsPost) domain.Post {
	return domain.Post{
		ID:        pgconv.UUIDToString(r.ID),
		AuthorID:  pgconv.UUIDToStringPtr(r.AuthorID),
		Title:     r.Title,
		Body:      r.Body,
		CreatedAt: pgconv.TimestamptzToTime(r.CreatedAt),
		UpdatedAt: pgconv.TimestamptzToTime(r.UpdatedAt),
		Version:   int(r.Version),
		DeletedAt: pgconv.TimestamptzToTimePtr(r.DeletedAt),
	}
}

func (r *Repository) Create(ctx context.Context, p application.CreatePostParams) (domain.Post, error) {
	row, err := r.q.CreatePost(ctx, db.CreatePostParams{
		ID:       pgconv.StringToUUID(pgconv.NewUUIDv7()),
		AuthorID: pgconv.StringToUUID(p.AuthorID),
		Title:    p.Title,
		Body:     p.Body,
	})
	if err != nil {
		return domain.Post{}, err
	}
	return toPost(row), nil
}

func (r *Repository) FindByID(ctx context.Context, id string) (*domain.Post, error) {
	row, err := r.q.GetPostByID(ctx, pgconv.StringToUUID(id))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	p := toPost(row)
	return &p, nil
}

func (r *Repository) List(ctx context.Context, limit, offset int) ([]domain.Post, error) {
	rows, err := r.q.ListPosts(ctx, db.ListPostsParams{Limit: int32(limit), Offset: int32(offset)})
	if err != nil {
		return nil, err
	}
	posts := make([]domain.Post, len(rows))
	for i, row := range rows {
		posts[i] = toPost(row)
	}
	return posts, nil
}

func (r *Repository) UpdateWithVersion(ctx context.Context, p application.UpdatePostParams) (*domain.Post, error) {
	row, err := r.q.UpdatePostWithVersion(ctx, db.UpdatePostWithVersionParams{
		Title:           pgconv.StringPtrToText(p.Title),
		Body:            pgconv.StringPtrToText(p.Body),
		UpdatedBy:       pgconv.StringToUUID(p.UpdatedBy),
		ID:              pgconv.StringToUUID(p.ID),
		ExpectedVersion: int32(p.ExpectedVersion),
	})
	if errors.Is(err, pgx.ErrNoRows) {
		// No live row at the expected version — optimistic-concurrency miss.
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	updated := toPost(row)
	return &updated, nil
}

func (r *Repository) AnonymizeAuthor(ctx context.Context, authorID string) error {
	return r.q.AnonymizeAuthor(ctx, pgconv.StringToUUID(authorID))
}
