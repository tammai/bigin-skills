package auth

import (
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func testIssuer() TokenIssuer {
	return NewTokenIssuer([]byte("test-secret"), 15*time.Minute, 7*24*time.Hour)
}

func TestAccessTokenRoundTrip(t *testing.T) {
	issuer := testIssuer()

	token, err := issuer.Access(42, RoleAdmin)
	if err != nil {
		t.Fatalf("Access() error: %v", err)
	}

	claims, err := issuer.Verify(token)
	if err != nil {
		t.Fatalf("Verify() error: %v", err)
	}
	if claims.UserID != 42 {
		t.Errorf("UserID = %d, want 42", claims.UserID)
	}
	if claims.Role != RoleAdmin {
		t.Errorf("Role = %q, want %q", claims.Role, RoleAdmin)
	}
}

func TestVerifyRejectsAForeignSecret(t *testing.T) {
	token, err := testIssuer().Access(1, RoleUser)
	if err != nil {
		t.Fatalf("Access() error: %v", err)
	}

	other := NewTokenIssuer([]byte("a-different-secret"), time.Minute, time.Hour)
	if _, err := other.Verify(token); err == nil {
		t.Fatal("Verify() accepted a token signed with a different secret")
	}
}

func TestVerifyRejectsAnExpiredToken(t *testing.T) {
	expired := NewTokenIssuer([]byte("test-secret"), -time.Minute, time.Hour)

	token, err := expired.Access(1, RoleUser)
	if err != nil {
		t.Fatalf("Access() error: %v", err)
	}
	if _, err := testIssuer().Verify(token); err == nil {
		t.Fatal("Verify() accepted an expired token")
	}
}

// The algorithm-confusion case. A token with alg=none carries valid-looking
// claims and an empty signature; accepting it means accepting anything the
// client cares to assert about itself.
func TestVerifyRejectsUnsignedTokens(t *testing.T) {
	unsigned, err := jwt.NewWithClaims(jwt.SigningMethodNone, jwt.MapClaims{
		"user_id": 1,
		"role":    RoleAdmin,
		"exp":     time.Now().Add(time.Hour).Unix(),
	}).SignedString(jwt.UnsafeAllowNoneSignatureType)
	if err != nil {
		t.Fatalf("building the alg=none token: %v", err)
	}

	if _, err := testIssuer().Verify(unsigned); err == nil {
		t.Fatal("Verify() accepted an alg=none token — the keyfunc must reject non-HMAC methods")
	}
}

func TestRefreshTokensAreRandomAndStoredHashed(t *testing.T) {
	issuer := testIssuer()

	raw1, hash1, err := issuer.NewRefreshToken()
	if err != nil {
		t.Fatalf("NewRefreshToken() error: %v", err)
	}
	raw2, _, err := issuer.NewRefreshToken()
	if err != nil {
		t.Fatalf("NewRefreshToken() error: %v", err)
	}

	if raw1 == raw2 {
		t.Error("two refresh tokens came out identical — the source is not random")
	}
	if raw1 == hash1 {
		t.Error("the stored value equals the raw token — the hash step is missing")
	}
	if hash1 != HashToken(raw1) {
		t.Error("HashToken does not reproduce the stored hash, so lookup by hash will never match")
	}
}

func TestPasswordHashing(t *testing.T) {
	hash, err := HashPassword("Sup3r$ecret")
	if err != nil {
		t.Fatalf("HashPassword() error: %v", err)
	}
	if hash == "Sup3r$ecret" {
		t.Fatal("the password was stored in plain text")
	}
	if err := CheckPassword(hash, "Sup3r$ecret"); err != nil {
		t.Errorf("CheckPassword() rejected the correct password: %v", err)
	}
	if err := CheckPassword(hash, "wrong"); err == nil {
		t.Error("CheckPassword() accepted the wrong password")
	}
}
