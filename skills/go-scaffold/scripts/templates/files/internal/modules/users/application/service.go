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
	"time"

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

// SessionRepository is the browser-session port. Like refresh tokens, sessions
// are addressed by hash because the cookie value is never stored.
// UpdateActivity persists only what sliding changes (LastSeenAt and
// IdleExpiresAt); Delete of an unknown hash is not an error.
// DeleteExpiredForUser removes that user's sessions whose idle or absolute
// expiry is at or before now.
type SessionRepository interface {
	Create(ctx context.Context, s *domain.Session) error
	ByHash(ctx context.Context, hash string) (*domain.Session, error)
	UpdateActivity(ctx context.Context, s *domain.Session) error
	Delete(ctx context.Context, hash string) error
	DeleteExpiredForUser(ctx context.Context, userID uint, now time.Time) error
}

// Service is the module's use-case surface. Dependencies arrive through
// NewService, so nothing here reaches for a package-level database handle.
type Service struct {
	users    UserRepository
	tokens   RefreshTokenRepository
	sessions SessionRepository
	issuer   auth.TokenIssuer
	policy   domain.SessionPolicy
	// now is the clock. A field rather than time.Now at each call site so the
	// session tests can move time instead of sleeping through it.
	now func() time.Time
}

func NewService(
	users UserRepository,
	tokens RefreshTokenRepository,
	sessions SessionRepository,
	issuer auth.TokenIssuer,
	policy domain.SessionPolicy,
) *Service {
	return &Service{
		users:    users,
		tokens:   tokens,
		sessions: sessions,
		issuer:   issuer,
		policy:   policy,
		now:      time.Now,
	}
}

// The users module is the auth middleware's session resolver; this assertion
// keeps the method signature and the kernel's interface from drifting apart.
var _ auth.SessionResolver = (*Service)(nil)

// Tokens is a freshly issued pair. The refresh value here is the RAW token —
// the only moment it exists outside the client, since storage keeps the hash.
type Tokens struct {
	Access  string
	Refresh string
}
