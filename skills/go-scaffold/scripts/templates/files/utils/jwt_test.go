package utils

import (
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func TestGenerateAccessTokenCarriesClaims(t *testing.T) {
	t.Setenv("JWT_SECRET", "test-secret")

	token, err := GenerateAccessToken(42, "admin")
	if err != nil {
		t.Fatalf("GenerateAccessToken: %v", err)
	}

	parsed, err := jwt.Parse(token, func(*jwt.Token) (interface{}, error) {
		return []byte("test-secret"), nil
	})
	if err != nil || !parsed.Valid {
		t.Fatalf("token did not verify against the signing secret: %v", err)
	}

	claims := parsed.Claims.(jwt.MapClaims)
	if claims["user_id"].(float64) != 42 {
		t.Errorf("user_id = %v, want 42", claims["user_id"])
	}
	if claims["role"].(string) != "admin" {
		t.Errorf("role = %v, want admin", claims["role"])
	}
}

// A token signed with a different secret must not verify — this is the check
// that would catch a build wiring the wrong (or an empty) JWT_SECRET.
func TestAccessTokenRejectsForeignSecret(t *testing.T) {
	t.Setenv("JWT_SECRET", "test-secret")

	token, err := GenerateAccessToken(1, "user")
	if err != nil {
		t.Fatalf("GenerateAccessToken: %v", err)
	}

	if _, err := jwt.Parse(token, func(*jwt.Token) (interface{}, error) {
		return []byte("other-secret"), nil
	}); err == nil {
		t.Fatal("token verified under a foreign secret, want failure")
	}
}

func TestGenerateRefreshTokenIsRandomAndOnlyHashedIsStored(t *testing.T) {
	raw1, hash1, err := GenerateRefreshToken()
	if err != nil {
		t.Fatalf("GenerateRefreshToken: %v", err)
	}
	raw2, _, err := GenerateRefreshToken()
	if err != nil {
		t.Fatalf("GenerateRefreshToken: %v", err)
	}

	if raw1 == raw2 {
		t.Fatal("two refresh tokens came back identical — the source of randomness is broken")
	}
	if hash1 == raw1 {
		t.Fatal("hash equals the raw token — the DB would be storing a usable credential")
	}
	if HashToken(raw1) != hash1 {
		t.Fatal("HashToken is not deterministic for the same input")
	}
}

func TestRefreshTokenExpiryHonoursEnv(t *testing.T) {
	t.Setenv("REFRESH_TOKEN_EXPIRY_DAYS", "3")
	if got := RefreshTokenExpiry(); got != 3*24*time.Hour {
		t.Errorf("RefreshTokenExpiry = %v, want 72h", got)
	}

	// A junk value must fall back to the default rather than expiring instantly.
	t.Setenv("REFRESH_TOKEN_EXPIRY_DAYS", "not-a-number")
	if got := RefreshTokenExpiry(); got != 7*24*time.Hour {
		t.Errorf("RefreshTokenExpiry with junk env = %v, want the 7-day default", got)
	}
}
