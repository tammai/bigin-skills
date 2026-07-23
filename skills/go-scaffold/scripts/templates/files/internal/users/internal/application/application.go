// Package application holds the users module's use-cases (ADR §4.2: all business
// logic lives here, never in api/ handlers). It depends on repository INTERFACES
// (defined here, implemented in infrastructure/) so unit tests substitute fakes
// with no DB and no mocking library.
package application

import (
	"context"
	"time"

	"{{MODULE}}/internal/shared/auth"
	"{{MODULE}}/internal/users/internal/domain"
)

// UsersRepo is the users-table persistence seam.
type UsersRepo interface {
	Create(ctx context.Context, p CreateUserParams) (domain.User, error)
	FindByID(ctx context.Context, id string) (*domain.User, error)
	FindByEmail(ctx context.Context, email string) (*domain.User, error)
	FindManyByIDs(ctx context.Context, ids []string) ([]domain.User, error)
	List(ctx context.Context, limit, offset int) ([]domain.User, error)
	// SoftDelete flags deleted_at; returns false if no live row matched.
	SoftDelete(ctx context.Context, id, actorID string) (found bool, err error)
}

// RefreshRepo is the refresh-token persistence seam.
type RefreshRepo interface {
	Create(ctx context.Context, p CreateRefreshParams) (domain.RefreshToken, error)
	FindByHash(ctx context.Context, hash string) (*domain.RefreshToken, error)
	// Revoke conditionally revokes a token only if it is still live
	// (revoked_at IS NULL). It reports whether a row was actually revoked:
	// false means the token was already revoked (lost a concurrent rotation
	// race), so the caller must NOT proceed to mint a replacement.
	Revoke(ctx context.Context, id string, replacedByID *string) (revoked bool, err error)
	RevokeFamily(ctx context.Context, familyID string) error
}

// PostAnonymizer is the cross-module dependency (posts satisfies it) that erase
// calls synchronously to scrub an erased user's authorship. Defined here on the
// CONSUMER side so the users module never imports the posts module (ADR §4.2).
type PostAnonymizer interface {
	AnonymizeAuthor(ctx context.Context, userID string) error
}

type CreateUserParams struct {
	Email        string
	Name         string
	PasswordHash string
	Roles        []string
	CreatedBy    *string
}

type CreateRefreshParams struct {
	// ID is the new token's primary key, minted by the use-case (not the repo)
	// so a rotation can name the replacement in the parent's replaced_by_id
	// BEFORE the child row exists — see Refresh's revoke-then-create ordering.
	ID        string
	UserID    string
	TokenHash string
	FamilyID  string
	ExpiresAt time.Time
}

type Service struct {
	users      UsersRepo
	tokens     RefreshRepo
	hasher     auth.PasswordHasher
	posts      PostAnonymizer
	refreshTTL time.Duration
}

func NewService(users UsersRepo, tokens RefreshRepo, hasher auth.PasswordHasher, refreshTTLDays int) *Service {
	return &Service{
		users:      users,
		tokens:     tokens,
		hasher:     hasher,
		refreshTTL: time.Duration(refreshTTLDays) * 24 * time.Hour,
	}
}

// UsePostAnonymizer injects the cross-module anonymizer. The composition root
// calls this once, after both modules are constructed, before serving.
func (s *Service) UsePostAnonymizer(p PostAnonymizer) { s.posts = p }

// LoginResult is returned by Login/Refresh; the api layer signs the access JWT
// from the principal (signing is a framework concern, credential logic is not).
type LoginResult struct {
	Principal    auth.Principal
	RefreshToken string
}

