package config

import (
	"testing"
	"time"
)

func TestParseOriginsDropsBlanks(t *testing.T) {
	cases := []struct {
		raw  string
		want []string
	}{
		{"", []string{}},
		{"   ", []string{}},
		{"http://a.test", []string{"http://a.test"}},
		{"http://a.test, http://b.test", []string{"http://a.test", "http://b.test"}},
		// A trailing comma is the common .env typo. It must not become an
		// empty-string entry in the allowlist.
		{"http://a.test,", []string{"http://a.test"}},
	}
	for _, tc := range cases {
		got := ParseOrigins(tc.raw)
		if len(got) != len(tc.want) {
			t.Fatalf("ParseOrigins(%q) = %v, want %v", tc.raw, got, tc.want)
		}
		for i := range got {
			if got[i] != tc.want[i] {
				t.Errorf("ParseOrigins(%q)[%d] = %q, want %q", tc.raw, i, got[i], tc.want[i])
			}
		}
	}
}

// Booting with no signing key would mean accepting forged tokens, so this is a
// hard failure rather than a warning.
func TestLoadRefusesAnEmptyJWTSecret(t *testing.T) {
	t.Setenv("JWT_SECRET", "")
	if _, err := Load(); err == nil {
		t.Fatal("Load() succeeded with an empty JWT_SECRET — it must refuse to start")
	}
}

func TestLoadAppliesDefaultsAndOverrides(t *testing.T) {
	t.Setenv("JWT_SECRET", "test-secret")
	t.Setenv("PORT", "")
	t.Setenv("ACCESS_TOKEN_EXPIRY_MINUTES", "30")
	// Garbage must fall back to the documented default, not take the boot down.
	t.Setenv("REFRESH_TOKEN_EXPIRY_DAYS", "not-a-number")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error: %v", err)
	}
	if cfg.Port != "8090" {
		t.Errorf("Port = %q, want the 8090 default", cfg.Port)
	}
	if cfg.AccessTokenTTL != 30*time.Minute {
		t.Errorf("AccessTokenTTL = %v, want 30m", cfg.AccessTokenTTL)
	}
	if cfg.RefreshTokenTTL != 7*24*time.Hour {
		t.Errorf("RefreshTokenTTL = %v, want the 7-day default", cfg.RefreshTokenTTL)
	}
}
