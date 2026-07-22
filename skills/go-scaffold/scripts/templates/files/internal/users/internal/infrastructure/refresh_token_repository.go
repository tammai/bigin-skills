package infrastructure

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"{{MODULE}}/internal/shared/pgconv"
	"{{MODULE}}/internal/users/internal/application"
	"{{MODULE}}/internal/users/internal/domain"
	"{{MODULE}}/internal/users/internal/infrastructure/db"
)

type RefreshTokenRepository struct {
	q *db.Queries
}

func NewRefreshTokenRepository(pool *pgxpool.Pool) *RefreshTokenRepository {
	return &RefreshTokenRepository{q: db.New(pool)}
}

func toRefreshToken(r db.UsersRefreshToken) domain.RefreshToken {
	return domain.RefreshToken{
		ID:           pgconv.UUIDToString(r.ID),
		UserID:       pgconv.UUIDToString(r.UserID),
		TokenHash:    r.TokenHash,
		FamilyID:     pgconv.UUIDToString(r.FamilyID),
		RevokedAt:    pgconv.TimestamptzToTimePtr(r.RevokedAt),
		ReplacedByID: pgconv.UUIDToStringPtr(r.ReplacedByID),
		ExpiresAt:    pgconv.TimestamptzToTime(r.ExpiresAt),
		CreatedAt:    pgconv.TimestamptzToTime(r.CreatedAt),
	}
}

func (r *RefreshTokenRepository) Create(ctx context.Context, p application.CreateRefreshParams) (domain.RefreshToken, error) {
	row, err := r.q.CreateRefreshToken(ctx, db.CreateRefreshTokenParams{
		ID:        pgconv.StringToUUID(p.ID),
		UserID:    pgconv.StringToUUID(p.UserID),
		TokenHash: p.TokenHash,
		FamilyID:  pgconv.StringToUUID(p.FamilyID),
		ExpiresAt: pgconv.TimeToTimestamptz(p.ExpiresAt),
	})
	if err != nil {
		return domain.RefreshToken{}, err
	}
	return toRefreshToken(row), nil
}

func (r *RefreshTokenRepository) FindByHash(ctx context.Context, hash string) (*domain.RefreshToken, error) {
	row, err := r.q.GetRefreshTokenByHash(ctx, hash)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	t := toRefreshToken(row)
	return &t, nil
}

// Revoke conditionally revokes a still-live token (the query's WHERE revoked_at
// IS NULL). It returns true only when a row was actually updated; false means
// the token was already revoked — the caller (rotation) must then abort rather
// than mint a replacement, which is what closes the refresh TOCTOU race.
func (r *RefreshTokenRepository) Revoke(ctx context.Context, id string, replacedByID *string) (bool, error) {
	rows, err := r.q.RevokeRefreshToken(ctx, db.RevokeRefreshTokenParams{
		ID:           pgconv.StringToUUID(id),
		ReplacedByID: pgconv.StringPtrToUUID(replacedByID),
	})
	if err != nil {
		return false, err
	}
	return rows == 1, nil
}

func (r *RefreshTokenRepository) RevokeFamily(ctx context.Context, familyID string) error {
	return r.q.RevokeRefreshTokenFamily(ctx, pgconv.StringToUUID(familyID))
}
