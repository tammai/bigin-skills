// Package domain holds the users module's entities and pure mapping rules — no
// framework, DB, or transport concerns (ADR §4.2: business logic stays out of
// api/, and the domain is the innermost, dependency-free layer).
package domain

import "time"

type User struct {
	ID           string
	Email        string
	Name         string
	PasswordHash string
	Roles        []string
	CreatedAt    time.Time
	UpdatedAt    time.Time
	Version      int
	DeletedAt    *time.Time
}

type RefreshToken struct {
	ID           string
	UserID       string
	TokenHash    string
	FamilyID     string
	RevokedAt    *time.Time
	ReplacedByID *string
	ExpiresAt    time.Time
	CreatedAt    time.Time
}

func (t RefreshToken) Revoked() bool  { return t.RevokedAt != nil }
func (t RefreshToken) Expired() bool  { return t.ExpiresAt.Before(time.Now()) }

// View is what the users API returns for its own resource.
type View struct {
	ID        string
	Email     string
	Name      string
	CreatedAt time.Time
}

// PublicView is the narrow shape other modules see (never the full entity).
type PublicView struct {
	ID   string
	Name string
}

func ToView(u User) View {
	return View{ID: u.ID, Email: u.Email, Name: u.Name, CreatedAt: u.CreatedAt}
}

func ToPublicView(u User) PublicView {
	return PublicView{ID: u.ID, Name: u.Name}
}
