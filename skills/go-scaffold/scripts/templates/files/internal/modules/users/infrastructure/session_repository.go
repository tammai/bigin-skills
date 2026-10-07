package infrastructure

import (
	"context"
	"time"

	"gorm.io/gorm"

	"{{MODULE}}/internal/modules/users/application"
	"{{MODULE}}/internal/modules/users/domain"
	"{{MODULE}}/internal/shared/apperr"
)

type SessionRepository struct {
	db *gorm.DB
}

func NewSessionRepository(db *gorm.DB) *SessionRepository {
	return &SessionRepository{db: db}
}

var _ application.SessionRepository = (*SessionRepository)(nil)

func (r *SessionRepository) Create(ctx context.Context, s *domain.Session) error {
	rec := sessionRecordOf(s)
	if err := r.db.WithContext(ctx).Create(&rec).Error; err != nil {
		return apperr.Internal("Failed to persist session", err)
	}
	*s = rec.toDomain()
	return nil
}

// ByHash is the only lookup, on the unique index over token_hash: the cookie
// value is never stored, so its hash is the only key there is.
func (r *SessionRepository) ByHash(ctx context.Context, hash string) (*domain.Session, error) {
	var rec sessionRecord
	if err := r.db.WithContext(ctx).Where("token_hash = ?", hash).First(&rec).Error; err != nil {
		return nil, translate(err, "Session not found", "Failed to load session")
	}
	s := rec.toDomain()
	return &s, nil
}

// UpdateActivity writes the two columns sliding changes and nothing else, so a
// concurrent request on the same session cannot clobber the absolute expiry
// with a stale copy.
func (r *SessionRepository) UpdateActivity(ctx context.Context, s *domain.Session) error {
	if err := r.db.WithContext(ctx).
		Model(&sessionRecord{}).
		Where("id = ?", s.ID).
		Updates(map[string]any{
			"last_seen_at":    s.LastSeenAt,
			"idle_expires_at": s.IdleExpiresAt,
		}).Error; err != nil {
		return apperr.Internal("Failed to update session", err)
	}
	return nil
}

// Delete is a DELETE with no existence check, so deleting an unknown hash
// succeeds and affects nothing — logout must not become a way to probe which
// sessions exist.
func (r *SessionRepository) Delete(ctx context.Context, hash string) error {
	if err := r.db.WithContext(ctx).Where("token_hash = ?", hash).Delete(&sessionRecord{}).Error; err != nil {
		return apperr.Internal("Failed to delete session", err)
	}
	return nil
}

// DeleteExpiredForUser prunes one user's dead sessions. The user_id index
// keeps it cheap, and the predicate mirrors domain.Session.Expired: a session
// is dead AT its expiry, not after it.
func (r *SessionRepository) DeleteExpiredForUser(ctx context.Context, userID uint, now time.Time) error {
	if err := r.db.WithContext(ctx).
		Where("user_id = ? AND (idle_expires_at <= ? OR absolute_expires_at <= ?)", userID, now, now).
		Delete(&sessionRecord{}).Error; err != nil {
		return apperr.Internal("Failed to prune expired sessions", err)
	}
	return nil
}
