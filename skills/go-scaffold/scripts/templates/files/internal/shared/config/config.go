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
	"os"
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
}

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

	return Config{
		Port:            envOr("PORT", "8090"),
		DatabaseDSN:     dsnFromEnv(),
		CORSOrigins:     ParseOrigins(os.Getenv("CORS_ORIGINS")),
		JWTSecret:       []byte(secret),
		AccessTokenTTL:  time.Duration(envInt("ACCESS_TOKEN_EXPIRY_MINUTES", 15)) * time.Minute,
		RefreshTokenTTL: time.Duration(envInt("REFRESH_TOKEN_EXPIRY_DAYS", 7)) * 24 * time.Hour,
	}, nil
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
