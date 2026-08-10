package arch_test

import (
	"os"
	"path/filepath"
	"testing"

	"{{MODULE}}/internal/arch"
)

// The real assertion: this repository obeys its own architecture.
func TestModuleBoundaries(t *testing.T) {
	root := filepath.Join("..", "..")

	violations, err := arch.Check(root)
	if err != nil {
		t.Fatalf("arch.Check: %v", err)
	}
	for _, v := range violations {
		t.Errorf("architecture violation:\n%s", v)
	}
}

// A checker whose patterns silently match nothing would keep the suite green
// while every boundary rotted. These fixtures prove it actually fires — and
// that it does not fire on the legal shape of the same import.
func TestCheckDetectsViolations(t *testing.T) {
	cases := []struct {
		name       string
		file       string
		imports    string
		wantCaught bool
	}{
		{
			name:       "another module's internals",
			file:       "internal/modules/posts/application/list.go",
			imports:    "example.test/app/internal/modules/users/infrastructure",
			wantCaught: true,
		},
		{
			name:       "another module's public contract",
			file:       "internal/modules/posts/application/list.go",
			imports:    "example.test/app/internal/modules/users",
			wantCaught: false,
		},
		{
			name:       "the composition root reaching into a module",
			file:       "internal/api/server.go",
			imports:    "example.test/app/internal/modules/users/application",
			wantCaught: true,
		},
		{
			name:       "application importing its own infrastructure",
			file:       "internal/modules/users/application/signup.go",
			imports:    "example.test/app/internal/modules/users/infrastructure",
			wantCaught: true,
		},
		{
			name:       "infrastructure importing its own application ports",
			file:       "internal/modules/users/infrastructure/repo.go",
			imports:    "example.test/app/internal/modules/users/application",
			wantCaught: false,
		},
		{
			name:       "domain importing gorm",
			file:       "internal/modules/users/domain/user.go",
			imports:    "gorm.io/gorm",
			wantCaught: true,
		},
		{
			name:       "domain importing gin",
			file:       "internal/modules/users/domain/user.go",
			imports:    "github.com/gin-gonic/gin",
			wantCaught: true,
		},
		{
			name:       "transport importing gin",
			file:       "internal/modules/users/api/handlers.go",
			imports:    "github.com/gin-gonic/gin",
			wantCaught: false,
		},
		{
			name:       "shared reaching into a module",
			file:       "internal/shared/httpx/httpx.go",
			imports:    "example.test/app/internal/modules/users",
			wantCaught: true,
		},
		{
			name:       "a module importing shared",
			file:       "internal/modules/users/domain/user.go",
			imports:    "example.test/app/internal/shared/apperr",
			wantCaught: false,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			root := fixture(t, tc.file, tc.imports)

			violations, err := arch.Check(root)
			if err != nil {
				t.Fatalf("arch.Check: %v", err)
			}

			caught := len(violations) > 0
			if caught != tc.wantCaught {
				t.Fatalf("caught = %v (%d violations), want %v\n%v",
					caught, len(violations), tc.wantCaught, violations)
			}
		})
	}
}

// fixture writes a throwaway module containing exactly one file with exactly
// one import, and returns its root.
func fixture(t *testing.T, file, importPath string) string {
	t.Helper()
	root := t.TempDir()

	if err := os.WriteFile(filepath.Join(root, "go.mod"), []byte("module example.test/app\n\ngo 1.24\n"), 0o644); err != nil {
		t.Fatalf("writing go.mod: %v", err)
	}

	full := filepath.Join(root, filepath.FromSlash(file))
	if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
		t.Fatalf("creating %s: %v", filepath.Dir(full), err)
	}

	src := "package p\n\nimport _ \"" + importPath + "\"\n"
	if err := os.WriteFile(full, []byte(src), 0o644); err != nil {
		t.Fatalf("writing %s: %v", full, err)
	}
	return root
}
