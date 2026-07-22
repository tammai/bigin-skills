// Package config loads and validates process configuration at boot. A missing
// required var (JWT_SECRET, DATABASE_URL) fails the process closed — it never
// falls back to a guessable default.
package config

import (
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/caarlos0/env/v11"
)

type Config struct {
	Addr        string   `env:"ADDR" envDefault:":8080"`
	DatabaseURL string   `env:"DATABASE_URL,required"`
	LogLevelStr string   `env:"LOG_LEVEL" envDefault:"info"`
	CORSOrigins []string `env:"CORS_ORIGINS" envSeparator:"," envDefault:"{{CORS}}"`

	// Auth. JWT_SECRET has no default: a missing signing key must crash the
	// process, never sign with a placeholder (ADR §7, §13).
	JWTSecret         string        `env:"JWT_SECRET,required"`
	JWTAccessTTL      time.Duration `env:"JWT_ACCESS_TTL" envDefault:"15m"`
	JWTRefreshTTLDays int           `env:"JWT_REFRESH_TTL_DAYS" envDefault:"30"`

	// argon2id parameters (OWASP baseline; tunable).
	Argon2Memory      uint32 `env:"ARGON2_MEMORY_COST" envDefault:"19456"`
	Argon2Time        uint32 `env:"ARGON2_TIME_COST" envDefault:"2"`
	Argon2Parallelism uint8  `env:"ARGON2_PARALLELISM" envDefault:"1"`
}

func Load() (Config, error) {
	var c Config
	if err := env.Parse(&c); err != nil {
		return Config{}, fmt.Errorf("parse config: %w", err)
	}
	return c, nil
}

func (c Config) LogLevel() slog.Level {
	switch strings.ToLower(c.LogLevelStr) {
	case "debug":
		return slog.LevelDebug
	case "warn":
		return slog.LevelWarn
	case "error":
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}
