package domain

import "time"

// RefreshToken is opaque — random bytes, not a JWT — and the database only ever
// holds its SHA-256 hash. The raw value exists in exactly two places: the
// response that issued it, and the request that spends it.
type RefreshToken struct {
	ID        uint
	UserID    uint
	TokenHash string
	Revoked   bool
	ExpiresAt time.Time
	CreatedAt time.Time
}

// Usable reports whether this token may still be exchanged.
//
// Rotation is what gives the Revoked check its teeth: every successful refresh
// revokes the token it consumed, so a second use of the same token is either a
// buggy client or a stolen token being replayed. Either way the answer is no.
func (t *RefreshToken) Usable(now time.Time) bool {
	return !t.Revoked && now.Before(t.ExpiresAt)
}
