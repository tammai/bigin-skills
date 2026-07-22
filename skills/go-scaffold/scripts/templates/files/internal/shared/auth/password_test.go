package auth

import (
	"strings"
	"testing"
)

// Uses the lowest argon2id parameters so the unit test stays fast; production
// values come from config.
func TestArgon2HasherRoundTrip(t *testing.T) {
	h := NewArgon2Hasher(8192, 1, 1)
	hash, err := h.Hash("password123")
	if err != nil {
		t.Fatalf("hash: %v", err)
	}
	if !strings.HasPrefix(hash, "$argon2id$") {
		t.Fatalf("expected argon2id encoded hash, got %q", hash)
	}

	ok, err := h.Verify(hash, "password123")
	if err != nil || !ok {
		t.Fatalf("verify correct password: ok=%v err=%v", ok, err)
	}
	bad, err := h.Verify(hash, "wrong")
	if err != nil || bad {
		t.Fatalf("verify wrong password: ok=%v err=%v", bad, err)
	}
}
