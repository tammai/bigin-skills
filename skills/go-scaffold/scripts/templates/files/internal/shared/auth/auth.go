// Package auth is the authentication kernel: roles, token minting and
// verification, and password hashing.
//
// It is framework-free by design — no gin, no gorm, no os.Getenv. That is what
// lets a module's application layer import it without dragging HTTP or the
// database into a use-case test. The gin middleware that USES this package
// lives in internal/api/middleware, on the transport side of the line.
package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

// The role vocabulary lives here rather than in a module because authorization
// is cross-cutting: the route selectors, the middleware, and every module that
// checks a permission all need the same strings.
const (
	RoleUser  = "user"
	RoleAdmin = "admin"
)

// Claims is the verified identity of a caller — the only thing a handler learns
// about who is making the request.
type Claims struct {
	UserID uint
	Role   string
}

// TokenIssuer mints and verifies both token types.
//
// It holds the signing key and lifetimes as fields instead of reading them from
// the environment on every call. The key is wiring: decided once in cmd/server,
// passed down explicitly. A package that reads os.Getenv mid-request is one
// deployment mistake away from signing with an empty key and telling nobody.
type TokenIssuer struct {
	secret     []byte
	accessTTL  time.Duration
	refreshTTL time.Duration
}

func NewTokenIssuer(secret []byte, accessTTL, refreshTTL time.Duration) TokenIssuer {
	return TokenIssuer{secret: secret, accessTTL: accessTTL, refreshTTL: refreshTTL}
}

func (t TokenIssuer) RefreshTTL() time.Duration { return t.refreshTTL }

// Access mints the short-lived JWT that authenticates each request.
func (t TokenIssuer) Access(userID uint, role string) (string, error) {
	now := time.Now()
	claims := jwt.MapClaims{
		"user_id": userID,
		"role":    role,
		"iat":     now.Unix(),
		"exp":     now.Add(t.accessTTL).Unix(),
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(t.secret)
}

// Verify parses and validates an access token.
//
// The keyfunc rejects any non-HMAC signing method. Without that check, a token
// with alg=none or an RS256 token signed with the public key would validate —
// the classic algorithm-confusion attack.
func (t TokenIssuer) Verify(tokenStr string) (Claims, error) {
	token, err := jwt.Parse(tokenStr, func(tok *jwt.Token) (any, error) {
		if _, ok := tok.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return t.secret, nil
	})
	if err != nil || !token.Valid {
		return Claims{}, errors.New("invalid or expired token")
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return Claims{}, errors.New("invalid token claims")
	}
	role, ok := claims["role"].(string)
	if !ok {
		return Claims{}, errors.New("invalid role claim")
	}
	// Every JSON number decodes as float64; there is no integer case to try.
	userID, ok := claims["user_id"].(float64)
	if !ok {
		return Claims{}, errors.New("invalid user_id claim")
	}

	return Claims{UserID: uint(userID), Role: role}, nil
}

// NewRefreshToken returns the raw token — sent to the client, never stored —
// and its hash, which is the only form that reaches the database. A leaked
// database dump therefore yields no usable refresh tokens.
func (t TokenIssuer) NewRefreshToken() (raw string, hash string, err error) {
	b := make([]byte, 32)
	if _, err = rand.Read(b); err != nil {
		return "", "", err
	}
	raw = hex.EncodeToString(b)
	return raw, HashToken(raw), nil
}

// HashToken is SHA-256, not bcrypt: refresh tokens are 256 bits of CSPRNG
// output, so there is no low-entropy secret to slow a brute force against, and
// the lookup happens on every refresh.
func HashToken(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}

// HashPassword uses bcrypt — passwords ARE low-entropy, so here the deliberate
// slowness is the point.
func HashPassword(plain string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(plain), bcrypt.DefaultCost)
	return string(hash), err
}

func CheckPassword(hash, plain string) error {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(plain))
}
