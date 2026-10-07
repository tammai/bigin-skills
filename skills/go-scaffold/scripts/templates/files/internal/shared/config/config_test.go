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

// Origins are compared after normalisation on both sides, so a WEB_ORIGINS
// entry written with a capital letter or a trailing slash still matches what a
// browser sends — and garbage never matches anything.
func TestNormalizeOrigin(t *testing.T) {
	cases := []struct {
		raw    string
		want   string
		wantOK bool
	}{
		{"https://app.example.com", "https://app.example.com", true},
		{"HTTPS://App.Example.COM/", "https://app.example.com", true},
		{"  http://localhost:3000  ", "http://localhost:3000", true},
		// Browsers send the literal "null" from sandboxed frames and some
		// redirects. It names no origin, so it can never be trusted.
		{"null", "", false},
		{"", "", false},
		{"app.example.com", "", false},
		{"ftp://app.example.com", "", false},
		{"https://app.example.com/path", "", false},
		{"https://app.example.com?x=1", "", false},
		{"https://user@app.example.com", "", false},
		// Browsers omit the scheme's default port from Origin, so an allowlist
		// entry that spells it out must reduce to the same string.
		{"https://app.example.com:443", "https://app.example.com", true},
		{"http://app.example.com:80/", "http://app.example.com", true},
		// A non-default port is part of the origin and stays.
		{"https://app.example.com:8443", "https://app.example.com:8443", true},
		{"http://app.example.com:443", "http://app.example.com:443", true},
	}
	for _, tc := range cases {
		got, ok := NormalizeOrigin(tc.raw)
		if got != tc.want || ok != tc.wantOK {
			t.Errorf("NormalizeOrigin(%q) = (%q, %v), want (%q, %v)", tc.raw, got, ok, tc.want, tc.wantOK)
		}
	}
}

// A wildcard in the CSRF allowlist would accept every site's forged request —
// the allowlist would exist and protect nothing. That is a boot failure.
func TestLoadRefusesAWildcardWebOrigin(t *testing.T) {
	t.Setenv("JWT_SECRET", "test-secret")
	for _, raw := range []string{"*", "https://app.example.com, *"} {
		t.Setenv("WEB_ORIGINS", raw)
		if _, err := Load(); err == nil {
			t.Errorf("Load() accepted WEB_ORIGINS=%q — a wildcard must refuse to start", raw)
		}
	}
}

// The session cookie rides along on every credentialed cross-origin request, so
// a wildcard CORS allowlist — echoing any Origin with Allow-Credentials — would
// let every site READ a logged-in user's responses. Refuse it at boot.
func TestLoadRefusesAWildcardCORSOrigin(t *testing.T) {
	t.Setenv("JWT_SECRET", "test-secret")
	for _, raw := range []string{"*", "http://localhost:3000, *"} {
		t.Setenv("CORS_ORIGINS", raw)
		if _, err := Load(); err == nil {
			t.Errorf("Load() accepted CORS_ORIGINS=%q — a wildcard must refuse to start", raw)
		}
	}
}

// An entry that is not an origin could never match a request, so the operator
// would see every browser mutation 403 with no hint why. Refuse it at boot.
func TestLoadRefusesAMalformedWebOrigin(t *testing.T) {
	t.Setenv("JWT_SECRET", "test-secret")
	t.Setenv("WEB_ORIGINS", "https://app.example.com/dashboard")
	if _, err := Load(); err == nil {
		t.Error("Load() accepted a WEB_ORIGINS entry with a path")
	}
}

func TestLoadNormalisesWebOrigins(t *testing.T) {
	t.Setenv("JWT_SECRET", "test-secret")
	t.Setenv("WEB_ORIGINS", "HTTPS://App.Example.com/, http://localhost:3000,")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error: %v", err)
	}
	want := []string{"https://app.example.com", "http://localhost:3000"}
	if len(cfg.WebOrigins) != len(want) {
		t.Fatalf("WebOrigins = %v, want %v", cfg.WebOrigins, want)
	}
	for i := range want {
		if cfg.WebOrigins[i] != want[i] {
			t.Errorf("WebOrigins[%d] = %q, want %q", i, cfg.WebOrigins[i], want[i])
		}
	}
}

func TestLoadSessionDefaults(t *testing.T) {
	t.Setenv("JWT_SECRET", "test-secret")
	t.Setenv("WEB_ORIGINS", "")
	t.Setenv("SESSION_IDLE_HOURS", "")
	t.Setenv("SESSION_ABSOLUTE_DAYS", "")
	t.Setenv("SESSION_COOKIE_SECURE", "")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error: %v", err)
	}
	// Empty is the safe default: every cookie mutation 403s until an operator
	// names the web app's origin.
	if len(cfg.WebOrigins) != 0 {
		t.Errorf("WebOrigins = %v, want empty by default", cfg.WebOrigins)
	}
	if cfg.SessionIdleTTL != 72*time.Hour {
		t.Errorf("SessionIdleTTL = %v, want 72h", cfg.SessionIdleTTL)
	}
	if cfg.SessionAbsoluteTTL != 30*24*time.Hour {
		t.Errorf("SessionAbsoluteTTL = %v, want 30 days", cfg.SessionAbsoluteTTL)
	}
	if !cfg.SessionCookieSecure || cfg.SessionCookieName != "__Host-session" {
		t.Errorf("cookie = (%q, secure=%v), want (__Host-session, secure=true)", cfg.SessionCookieName, cfg.SessionCookieSecure)
	}
}

// The __Host- prefix is only accepted by browsers on a Secure cookie, so the
// plain-HTTP dev mode has to drop the prefix along with the flag — otherwise
// the browser silently discards the cookie and login appears to do nothing.
func TestLoadInsecureDevCookieDropsTheHostPrefix(t *testing.T) {
	t.Setenv("JWT_SECRET", "test-secret")
	t.Setenv("SESSION_COOKIE_SECURE", "false")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error: %v", err)
	}
	if cfg.SessionCookieSecure || cfg.SessionCookieName != "session" {
		t.Errorf("cookie = (%q, secure=%v), want (session, secure=false)", cfg.SessionCookieName, cfg.SessionCookieSecure)
	}
}

// Anything that is not an explicit "false" keeps the cookie Secure. A typo must
// never be the thing that downgrades it.
func TestLoadKeepsTheCookieSecureOnGarbage(t *testing.T) {
	t.Setenv("JWT_SECRET", "test-secret")
	t.Setenv("SESSION_COOKIE_SECURE", "nope")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error: %v", err)
	}
	if !cfg.SessionCookieSecure {
		t.Error("SESSION_COOKIE_SECURE=nope downgraded the cookie to insecure")
	}
}
