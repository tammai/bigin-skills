// Package config resolves every environment-derived value exactly once, at
// startup, into a single struct.
//
// Nothing below cmd/server reads os.Getenv. A package that reaches for the
// environment mid-request is invisible in the wiring, impossible to test
// without t.Setenv, and one typo away from silently signing tokens with an
// empty key — which is the specific failure this type exists to prevent.
package config

import (
	"errors"
	"fmt"
	"log"
	"net/url"
	"os"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	Port            string
	DatabaseDSN     string
	CORSOrigins     []string
	JWTSecret       []byte
	AccessTokenTTL  time.Duration
	RefreshTokenTTL time.Duration

	// WebOrigins is the CSRF allowlist for cookie-authenticated requests,
	// normalised with NormalizeOrigin. Deliberately separate from CORSOrigins:
	// CORS decides which sites may READ responses, this decides which may
	// CHANGE state with a user's cookie, and widening one must never widen the
	// other by accident.
	WebOrigins          []string
	SessionIdleTTL      time.Duration
	SessionAbsoluteTTL  time.Duration
	SessionCookieSecure bool
	SessionCookieName   string

	// TrustedProxy names the proxy in front of this service, or is empty for
	// none. Empty means the client IP is the TCP peer and every forwarding
	// header is ignored; TrustedProxyCloudflare additionally honours a valid
	// CF-Connecting-IP. See api.Options.TrustedProxy.
	TrustedProxy string
}

// TrustedProxyCloudflare is the one proxy mode besides "none". It is only safe
// when the origin is reachable solely through Cloudflare — see the README.
const TrustedProxyCloudflare = "cloudflare"

// Session cookie names. The __Host- prefix makes the browser refuse the cookie
// unless it is Secure, has Path=/ and no Domain — so a sibling subdomain or a
// plain-HTTP response can never plant or overwrite it. Browsers enforce the
// Secure half too, which is why insecure dev mode must use the bare name.
const (
	secureSessionCookieName   = "__Host-session"
	insecureSessionCookieName = "session"
)

// Load reads .env when present, then resolves Config from the process
// environment. A missing .env is not an error — in containers and CI the
// variables come from the environment itself.
func Load() (Config, error) {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using system environment variables")
	}

	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		// An empty signing key would accept forged tokens, so refusing to boot
		// is never the riskier option here.
		return Config{}, errors.New("JWT_SECRET is not set — refusing to start with an empty signing key")
	}

	corsOrigins := ParseOrigins(os.Getenv("CORS_ORIGINS"))
	if slices.Contains(corsOrigins, "*") {
		// The session cookie rides along on every credentialed cross-origin
		// request, so echoing any Origin with Allow-Credentials would let any
		// site read a logged-in user's responses.
		return Config{}, errors.New("CORS_ORIGINS contains \"*\" — refusing to start: list each frontend origin explicitly")
	}

	webOrigins, err := parseWebOrigins(os.Getenv("WEB_ORIGINS"))
	if err != nil {
		return Config{}, err
	}

	trustedProxy, err := parseTrustedProxy(os.Getenv("TRUSTED_PROXY"))
	if err != nil {
		return Config{}, err
	}

	secure := envBoolDefaultTrue("SESSION_COOKIE_SECURE")
	cookieName := secureSessionCookieName
	if !secure {
		cookieName = insecureSessionCookieName
		log.Println("WARNING: SESSION_COOKIE_SECURE=false — the session cookie is sent over plain HTTP. Local development only.")
	}

	return Config{
		Port:                envOr("PORT", "8090"),
		DatabaseDSN:         dsnFromEnv(),
		CORSOrigins:         corsOrigins,
		JWTSecret:           []byte(secret),
		AccessTokenTTL:      time.Duration(envInt("ACCESS_TOKEN_EXPIRY_MINUTES", 15)) * time.Minute,
		RefreshTokenTTL:     time.Duration(envInt("REFRESH_TOKEN_EXPIRY_DAYS", 7)) * 24 * time.Hour,
		WebOrigins:          webOrigins,
		SessionIdleTTL:      time.Duration(envInt("SESSION_IDLE_HOURS", 72)) * time.Hour,
		SessionAbsoluteTTL:  time.Duration(envInt("SESSION_ABSOLUTE_DAYS", 30)) * 24 * time.Hour,
		SessionCookieSecure: secure,
		SessionCookieName:   cookieName,
		TrustedProxy:        trustedProxy,
	}, nil
}

// parseTrustedProxy accepts empty (no trusted proxy) or "cloudflare". Anything
// else refuses to boot: a typo such as "cloudflair" would otherwise silently
// fall back to RemoteAddr, and behind Cloudflare every client would then share
// one rate-limit bucket with no hint why.
func parseTrustedProxy(raw string) (string, error) {
	switch v := strings.ToLower(strings.TrimSpace(raw)); v {
	case "", TrustedProxyCloudflare:
		return v, nil
	default:
		return "", fmt.Errorf("TRUSTED_PROXY=%q is not supported — refusing to start: leave it empty or set %q", raw, TrustedProxyCloudflare)
	}
}

// parseWebOrigins normalises every entry, and refuses to boot on one that can
// only be a mistake. A "*" would turn the CSRF allowlist into a formality; an
// entry that is not an origin at all would never match, and every browser
// mutation would 403 with nothing pointing at the cause.
func parseWebOrigins(raw string) ([]string, error) {
	out := []string{}
	for _, entry := range ParseOrigins(raw) {
		if entry == "*" {
			return nil, errors.New("WEB_ORIGINS contains \"*\" — refusing to start: list each web app origin explicitly")
		}
		origin, ok := NormalizeOrigin(entry)
		if !ok {
			return nil, fmt.Errorf("WEB_ORIGINS entry %q is not an origin (scheme://host[:port], no path)", entry)
		}
		out = append(out, origin)
	}
	return out, nil
}

// NormalizeOrigin reduces an origin to the form both sides of the CORS and
// CSRF comparisons use: lowercase scheme and host, no trailing slash, and no
// default port (browsers omit :443 for https and :80 for http). It reports
// false for anything that is not an http(s) origin — including the literal
// "null" browsers send from sandboxed frames — so a caller can treat "not
// normalisable" and "not allowed" as the same answer.
func NormalizeOrigin(raw string) (string, bool) {
	trimmed := strings.TrimSuffix(strings.TrimSpace(raw), "/")
	u, err := url.Parse(trimmed)
	if err != nil || u.Host == "" || u.User != nil || u.Path != "" || u.RawQuery != "" || u.Fragment != "" {
		return "", false
	}
	scheme := strings.ToLower(u.Scheme)
	if scheme != "http" && scheme != "https" {
		return "", false
	}
	host := strings.ToLower(u.Host)
	if (scheme == "https" && u.Port() == "443") || (scheme == "http" && u.Port() == "80") {
		host = strings.TrimSuffix(host, ":"+u.Port())
	}
	return scheme + "://" + host, true
}

func dsnFromEnv() string {
	return fmt.Sprintf(
		"host=%s user=%s password=%s dbname=%s port=%s sslmode=%s TimeZone=UTC",
		os.Getenv("DB_HOST"), os.Getenv("DB_USER"), os.Getenv("DB_PASSWORD"),
		os.Getenv("DB_NAME"), os.Getenv("DB_PORT"), os.Getenv("DB_SSLMODE"),
	)
}

// ParseOrigins splits the CORS allowlist and drops blanks, so a trailing comma
// in .env can't turn into an empty-string origin that matches nothing (or, in a
// sloppier implementation, everything).
func ParseOrigins(raw string) []string {
	out := []string{}
	for _, o := range strings.Split(raw, ",") {
		if trimmed := strings.TrimSpace(o); trimmed != "" {
			out = append(out, trimmed)
		}
	}
	return out
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// envBoolDefaultTrue is true unless the value is explicitly false. It guards a
// security flag, so a typo has to fail closed (secure), never open.
func envBoolDefaultTrue(key string) bool {
	v := os.Getenv(key)
	if v == "" {
		return true
	}
	parsed, err := strconv.ParseBool(v)
	if err != nil {
		log.Printf("config: ignoring invalid %s=%q, using true", key, v)
		return true
	}
	return parsed
}

// envInt ignores a value that isn't a positive integer rather than failing the
// boot: a malformed expiry should fall back to the documented default, not take
// the service down.
func envInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if parsed, err := strconv.Atoi(v); err == nil && parsed > 0 {
			return parsed
		}
		log.Printf("config: ignoring invalid %s=%q, using %d", key, v, fallback)
	}
	return fallback
}
