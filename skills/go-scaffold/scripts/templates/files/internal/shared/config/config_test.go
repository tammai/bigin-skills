package config

import (
	"os"
	"testing"
)

// Load must fail closed: a missing JWT_SECRET or DATABASE_URL is a hard error,
// never a silent fallback to a guessable default (ADR §7, §13).
func TestLoadFailsClosedOnMissingRequiredVars(t *testing.T) {
	for _, missing := range []string{"JWT_SECRET", "DATABASE_URL"} {
		t.Run("errors when "+missing+" is unset", func(t *testing.T) {
			// Set both required vars, then remove the one under test. t.Setenv
			// registers restoration of both, so os.Unsetenv here doesn't leak
			// across subtests.
			t.Setenv("JWT_SECRET", "some-secret")
			t.Setenv("DATABASE_URL", "postgres://user:pass@localhost:5432/app")
			if err := os.Unsetenv(missing); err != nil {
				t.Fatalf("unset %s: %v", missing, err)
			}

			if _, err := Load(); err == nil {
				t.Fatalf("Load() must return an error when %s is unset", missing)
			}
		})
	}
}

func TestLoadSucceedsWithRequiredVars(t *testing.T) {
	t.Setenv("JWT_SECRET", "some-secret")
	t.Setenv("DATABASE_URL", "postgres://user:pass@localhost:5432/app")
	if _, err := Load(); err != nil {
		t.Fatalf("Load() with all required vars set should succeed, got %v", err)
	}
}
