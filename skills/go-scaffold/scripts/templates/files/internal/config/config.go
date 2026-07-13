package config

import (
	"fmt"
	"log/slog"
	"strings"

	"github.com/caarlos0/env/v11"
)

type Config struct {
	Addr        string   `env:"ADDR" envDefault:":8080"`
	DatabaseURL string   `env:"DATABASE_URL,required"`
	LogLevelStr string   `env:"LOG_LEVEL" envDefault:"info"`
	CORSOrigins []string `env:"CORS_ORIGINS" envSeparator:"," envDefault:"{{CORS}}"`
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
