// Package infrastructure implements the users module's ports against Postgres
// via GORM.
//
// It is the only place in the module that knows a database exists. Two rules
// keep that true and are worth stating because breaking either is easy and
// silent:
//
//  1. The GORM shapes below are unexported. A caller that could name
//     userRecord would start passing it around, and the domain entity would
//     quietly become decorative.
//  2. Every method translates storage errors into apperr values. A raw
//     gorm.ErrRecordNotFound escaping this package would force the application
//     layer to import gorm to check for it — which internal/arch forbids, and
//     which is exactly the coupling this layer exists to absorb.
package infrastructure

import (
	"time"

	"{{MODULE}}/internal/modules/users/domain"
)

// userRecord is the PERSISTENCE shape. GORM tags live here and nowhere else, so
// a column rename or a new index never reaches domain.User.
type userRecord struct {
	ID           uint `gorm:"primaryKey"`
	Email        string
	PasswordHash string
	FullName     string
	Role         string
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

// TableName is required, not cosmetic: GORM would otherwise pluralise the
// struct name to "user_records" and every query would miss the table the
// migrations actually created.
func (userRecord) TableName() string { return "users" }

func (r userRecord) toDomain() domain.User {
	return domain.User{
		ID:           r.ID,
		Email:        r.Email,
		PasswordHash: r.PasswordHash,
		FullName:     r.FullName,
		Role:         r.Role,
		CreatedAt:    r.CreatedAt,
		UpdatedAt:    r.UpdatedAt,
	}
}

func userRecordOf(u *domain.User) userRecord {
	return userRecord{
		ID:           u.ID,
		Email:        u.Email,
		PasswordHash: u.PasswordHash,
		FullName:     u.FullName,
		Role:         u.Role,
		CreatedAt:    u.CreatedAt,
		UpdatedAt:    u.UpdatedAt,
	}
}

type refreshTokenRecord struct {
	ID        uint `gorm:"primaryKey"`
	UserID    uint
	TokenHash string
	Revoked   bool
	ExpiresAt time.Time
	CreatedAt time.Time
}

func (refreshTokenRecord) TableName() string { return "refresh_tokens" }

func (r refreshTokenRecord) toDomain() domain.RefreshToken {
	return domain.RefreshToken{
		ID:        r.ID,
		UserID:    r.UserID,
		TokenHash: r.TokenHash,
		Revoked:   r.Revoked,
		ExpiresAt: r.ExpiresAt,
		CreatedAt: r.CreatedAt,
	}
}

func refreshTokenRecordOf(t *domain.RefreshToken) refreshTokenRecord {
	return refreshTokenRecord{
		ID:        t.ID,
		UserID:    t.UserID,
		TokenHash: t.TokenHash,
		Revoked:   t.Revoked,
		ExpiresAt: t.ExpiresAt,
		CreatedAt: t.CreatedAt,
	}
}
