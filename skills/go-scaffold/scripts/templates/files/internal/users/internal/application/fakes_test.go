package application

import (
	"context"

	"{{MODULE}}/internal/users/internal/domain"
)

// Hand-written fakes satisfying the application's repository interfaces — the Go
// idiom (function fields), no mocking library. Each test wires only the methods
// it exercises; unset methods panic loudly if unexpectedly called.

type fakeUsers struct {
	createFn        func(ctx context.Context, p CreateUserParams) (domain.User, error)
	findByIDFn      func(ctx context.Context, id string) (*domain.User, error)
	findByEmailFn   func(ctx context.Context, email string) (*domain.User, error)
	findManyByIDsFn func(ctx context.Context, ids []string) ([]domain.User, error)
	listFn          func(ctx context.Context, limit, offset int) ([]domain.User, error)
	softDeleteFn    func(ctx context.Context, id, actorID string) (bool, error)
}

func (f *fakeUsers) Create(ctx context.Context, p CreateUserParams) (domain.User, error) {
	return f.createFn(ctx, p)
}
func (f *fakeUsers) FindByID(ctx context.Context, id string) (*domain.User, error) {
	return f.findByIDFn(ctx, id)
}
func (f *fakeUsers) FindByEmail(ctx context.Context, email string) (*domain.User, error) {
	return f.findByEmailFn(ctx, email)
}
func (f *fakeUsers) FindManyByIDs(ctx context.Context, ids []string) ([]domain.User, error) {
	return f.findManyByIDsFn(ctx, ids)
}
func (f *fakeUsers) List(ctx context.Context, limit, offset int) ([]domain.User, error) {
	return f.listFn(ctx, limit, offset)
}
func (f *fakeUsers) SoftDelete(ctx context.Context, id, actorID string) (bool, error) {
	return f.softDeleteFn(ctx, id, actorID)
}

type fakeTokens struct {
	createFn       func(ctx context.Context, p CreateRefreshParams) (domain.RefreshToken, error)
	findByHashFn   func(ctx context.Context, hash string) (*domain.RefreshToken, error)
	revokeFn       func(ctx context.Context, id string, replacedByID *string) (bool, error)
	revokeFamilyFn func(ctx context.Context, familyID string) error
}

func (f *fakeTokens) Create(ctx context.Context, p CreateRefreshParams) (domain.RefreshToken, error) {
	return f.createFn(ctx, p)
}
func (f *fakeTokens) FindByHash(ctx context.Context, hash string) (*domain.RefreshToken, error) {
	return f.findByHashFn(ctx, hash)
}
func (f *fakeTokens) Revoke(ctx context.Context, id string, replacedByID *string) (bool, error) {
	return f.revokeFn(ctx, id, replacedByID)
}
func (f *fakeTokens) RevokeFamily(ctx context.Context, familyID string) error {
	return f.revokeFamilyFn(ctx, familyID)
}

type fakeHasher struct {
	hashFn   func(plain string) (string, error)
	verifyFn func(hash, plain string) (bool, error)
}

func (f *fakeHasher) Hash(plain string) (string, error)        { return f.hashFn(plain) }
func (f *fakeHasher) Verify(hash, plain string) (bool, error)  { return f.verifyFn(hash, plain) }

type fakeAnonymizer struct {
	calledWith string
	err        error
}

func (f *fakeAnonymizer) AnonymizeAuthor(_ context.Context, userID string) error {
	f.calledWith = userID
	return f.err
}
