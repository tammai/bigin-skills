package utils

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"os"
	"strconv"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// GenerateAccessToken creates a short-lived JWT used to authenticate each request.
func GenerateAccessToken(userID uint, role string) (string, error) {
	expMinutes := 15
	if v := os.Getenv("ACCESS_TOKEN_EXPIRY_MINUTES"); v != "" {
		if parsed, err := strconv.Atoi(v); err == nil && parsed > 0 {
			expMinutes = parsed
		}
	}

	claims := jwt.MapClaims{
		"user_id": userID,
		"role":    role,
		"iat":     time.Now().Unix(),
		"exp":     time.Now().Add(time.Duration(expMinutes) * time.Minute).Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(os.Getenv("JWT_SECRET")))
}

// GenerateRefreshToken generates a random opaque token (not a JWT).
// rawToken is sent to the client; only its hash is stored in the DB — never
// store the raw token.
func GenerateRefreshToken() (rawToken string, hash string, err error) {
	b := make([]byte, 32)
	if _, err = rand.Read(b); err != nil {
		return "", "", err
	}
	rawToken = hex.EncodeToString(b)
	hash = HashToken(rawToken)
	return rawToken, hash, nil
}

func HashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func RefreshTokenExpiry() time.Duration {
	days := 7
	if v := os.Getenv("REFRESH_TOKEN_EXPIRY_DAYS"); v != "" {
		if parsed, err := strconv.Atoi(v); err == nil && parsed > 0 {
			days = parsed
		}
	}
	return time.Duration(days) * 24 * time.Hour
}
