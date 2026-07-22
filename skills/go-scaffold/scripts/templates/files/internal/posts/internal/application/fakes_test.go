package application

import (
	"context"

	"{{MODULE}}/internal/posts/internal/domain"
)

type fakePosts struct {
	createFn      func(ctx context.Context, p CreatePostParams) (domain.Post, error)
	findByIDFn    func(ctx context.Context, id string) (*domain.Post, error)
	listFn        func(ctx context.Context, limit, offset int) ([]domain.Post, error)
	updateFn      func(ctx context.Context, p UpdatePostParams) (*domain.Post, error)
	anonymizeFn   func(ctx context.Context, authorID string) error
}

func (f *fakePosts) Create(ctx context.Context, p CreatePostParams) (domain.Post, error) {
	return f.createFn(ctx, p)
}
func (f *fakePosts) FindByID(ctx context.Context, id string) (*domain.Post, error) {
	return f.findByIDFn(ctx, id)
}
func (f *fakePosts) List(ctx context.Context, limit, offset int) ([]domain.Post, error) {
	return f.listFn(ctx, limit, offset)
}
func (f *fakePosts) UpdateWithVersion(ctx context.Context, p UpdatePostParams) (*domain.Post, error) {
	return f.updateFn(ctx, p)
}
func (f *fakePosts) AnonymizeAuthor(ctx context.Context, authorID string) error {
	return f.anonymizeFn(ctx, authorID)
}

type fakeUserDir struct {
	calls int
	fn    func(ctx context.Context, ids []string) (map[string]string, error)
}

func (f *fakeUserDir) GetManyByIDs(ctx context.Context, ids []string) (map[string]string, error) {
	f.calls++
	return f.fn(ctx, ids)
}
