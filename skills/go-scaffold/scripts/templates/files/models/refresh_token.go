package models

import "time"

type RefreshToken struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	UserID    uint      `json:"user_id" gorm:"not null;index"`
	TokenHash string    `json:"-" gorm:"unique;not null"`
	Revoked   bool      `json:"revoked" gorm:"default:false"`
	ExpiresAt time.Time `json:"expires_at"`
	CreatedAt time.Time `json:"created_at"`
}
