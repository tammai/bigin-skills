// Package auth is the shared-kernel auth engine (ADR §7): JWT issue/verify,
// argon2id password hashing, refresh-token helpers, and static RBAC. The
// backend issues AND verifies its own tokens (HS256, single shared secret) —
// asymmetric keys + JWKS are only needed once a second service must verify
// independently.
package auth

import (
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// Minimal claims (ADR §7): subject (user id) + role ids only. The cookie/token
// never carries the expanded permission list — the backend resolves
// roles→permissions per request via rbac.go.
type accessClaims struct {
	Roles []string `json:"roles"`
	jwt.RegisteredClaims
}

type JWT struct {
	secret    []byte
	accessTTL time.Duration
}

func NewJWT(secret string, accessTTL time.Duration) *JWT {
	return &JWT{secret: []byte(secret), accessTTL: accessTTL}
}

func (j *JWT) AccessTTL() time.Duration { return j.accessTTL }

// Sign issues a short-lived access token (ADR §7: TTL ~15m).
func (j *JWT) Sign(sub string, roles []string) (string, error) {
	now := time.Now()
	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, accessClaims{
		Roles: roles,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   sub,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(j.accessTTL)),
		},
	})
	return tok.SignedString(j.secret)
}

// Parse verifies signature + expiry and returns the principal. HS256 is pinned
// as the only accepted algorithm (reject `alg: none` and RS/ES confusion).
func (j *JWT) Parse(token string) (Principal, error) {
	var c accessClaims
	_, err := jwt.ParseWithClaims(token, &c, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return j.secret, nil
	})
	if err != nil {
		return Principal{}, err
	}
	return Principal{Sub: c.Subject, Roles: c.Roles}, nil
}
