// Package application holds the users module's use cases — one exported method
// per thing the product can do, each orchestrating domain rules and storage.
//
// It depends on PORTS it declares itself (the interfaces below), never on the
// infrastructure that implements them. That direction is the whole point: every
// test in this package runs against an in-memory fake with no database, no
// Docker, and no fixtures, and internal/arch fails the build if an import ever
// points the other way.
package application

import (
	"context"

	"{{MODULE}}/internal/modules/users/domain"
	"{{MODULE}}/internal/shared/auth"
)

// UserRepository is a port. Its methods are named for what the use cases need,
// not for what SQL makes convenient.
//
// Implementations translate storage failures into apperr values — a missing row
// is apperr.NotFound, anything else is apperr.Internal wrapping the driver
// error. That contract is what keeps gorm.ErrRecordNotFound out of this
// package entirely.
type UserRepository interface {
	Create(ctx context.Context, u *domain.User) error
	Update(ctx context.Context, u *domain.User) error
	Delete(ctx context.Context, id uint) error
	ByID(ctx context.Context, id uint) (*domain.User, error)
	ByEmail(ctx context.Context, email string) (*domain.User, error)
	Page(ctx context.Context, offset, limit int) ([]domain.User, int64, error)
}

// RefreshTokenRepository is the second port. Tokens are addressed by hash
// because the raw value is never stored.
type RefreshTokenRepository interface {
	Create(ctx context.Context, t *domain.RefreshToken) error
	ByHash(ctx context.Context, hash string) (*domain.RefreshToken, error)
	Revoke(ctx context.Context, hash string) error
}

// Service is the module's use-case surface. Dependencies arrive through
// NewService, so nothing here reaches for a package-level database handle.
type Service struct {
	users  UserRepository
	tokens RefreshTokenRepository
	issuer auth.TokenIssuer
}

func NewService(users UserRepository, tokens RefreshTokenRepository, issuer auth.TokenIssuer) *Service {
	return &Service{users: users, tokens: tokens, issuer: issuer}
}

// Tokens is a freshly issued pair. The refresh value here is the RAW token —
// the only moment it exists outside the client, since storage keeps the hash.
type Tokens struct {
	Access  string
	Refresh string
}
