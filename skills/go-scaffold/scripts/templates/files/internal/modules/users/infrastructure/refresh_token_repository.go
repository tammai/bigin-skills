package infrastructure

import (
	"context"

	"gorm.io/gorm"

	"{{MODULE}}/internal/modules/users/application"
	"{{MODULE}}/internal/modules/users/domain"
	"{{MODULE}}/internal/shared/apperr"
)

type RefreshTokenRepository struct {
	db *gorm.DB
}

func NewRefreshTokenRepository(db *gorm.DB) *RefreshTokenRepository {
	return &RefreshTokenRepository{db: db}
}

var _ application.RefreshTokenRepository = (*RefreshTokenRepository)(nil)

func (r *RefreshTokenRepository) Create(ctx context.Context, t *domain.RefreshToken) error {
	rec := refreshTokenRecordOf(t)
	if err := r.db.WithContext(ctx).Create(&rec).Error; err != nil {
		return apperr.Internal("Failed to persist refresh token", err)
	}
	*t = rec.toDomain()
	return nil
}

// ByHash is the only lookup: tokens are addressed by their SHA-256 hash because
// the raw value is never stored.
func (r *RefreshTokenRepository) ByHash(ctx context.Context, hash string) (*domain.RefreshToken, error) {
	var rec refreshTokenRecord
	if err := r.db.WithContext(ctx).Where("token_hash = ?", hash).First(&rec).Error; err != nil {
		return nil, translate(err, "Refresh token not found", "Failed to load refresh token")
	}
	t := rec.toDomain()
	return &t, nil
}

// Revoke is an UPDATE with no existence check, so revoking an unknown hash
// succeeds and affects nothing. That is deliberate — logout must not become a
// way to probe which tokens exist.
func (r *RefreshTokenRepository) Revoke(ctx context.Context, hash string) error {
	if err := r.db.WithContext(ctx).
		Model(&refreshTokenRecord{}).
		Where("token_hash = ?", hash).
		Update("revoked", true).Error; err != nil {
		return apperr.Internal("Failed to revoke refresh token", err)
	}
	return nil
}
