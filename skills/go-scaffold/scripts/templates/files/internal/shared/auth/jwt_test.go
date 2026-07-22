package auth

import (
	"testing"
	"time"
)

func TestJWTSignAndParseRoundTrip(t *testing.T) {
	j := NewJWT("test-secret", 15*time.Minute)
	token, err := j.Sign("user-1", []string{RoleAdmin})
	if err != nil {
		t.Fatalf("sign: %v", err)
	}
	p, err := j.Parse(token)
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	if p.Sub != "user-1" {
		t.Fatalf("sub = %q, want user-1", p.Sub)
	}
	if len(p.Roles) != 1 || p.Roles[0] != RoleAdmin {
		t.Fatalf("roles = %v, want [admin]", p.Roles)
	}
}

func TestJWTRejectsExpired(t *testing.T) {
	j := NewJWT("test-secret", -time.Minute) // already expired
	token, err := j.Sign("user-1", []string{RoleUser})
	if err != nil {
		t.Fatalf("sign: %v", err)
	}
	if _, err := j.Parse(token); err == nil {
		t.Fatal("expected an error parsing an expired token")
	}
}

func TestJWTRejectsWrongSecret(t *testing.T) {
	token, _ := NewJWT("secret-a", time.Minute).Sign("u", []string{RoleUser})
	if _, err := NewJWT("secret-b", time.Minute).Parse(token); err == nil {
		t.Fatal("expected an error parsing with the wrong secret")
	}
}

func TestHashRefreshTokenIsDeterministic(t *testing.T) {
	a := HashRefreshToken("abc")
	b := HashRefreshToken("abc")
	if a != b {
		t.Fatal("hash should be deterministic")
	}
	if a == HashRefreshToken("abd") {
		t.Fatal("different inputs should hash differently")
	}
}

func TestGenerateRefreshTokenIsUnique(t *testing.T) {
	a, err := GenerateRefreshToken()
	if err != nil {
		t.Fatal(err)
	}
	b, _ := GenerateRefreshToken()
	if a == b || a == "" {
		t.Fatalf("expected unique non-empty tokens, got %q and %q", a, b)
	}
}
