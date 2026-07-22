//go:build integration

// Full HTTP round trip against a real Postgres (testcontainers-go) — the
// automated version of the manual golden path. The one place the module
// boundary (cross-module GetManyByIDs + AnonymizeAuthor), optimistic
// concurrency, and soft-delete/erase are proven working TOGETHER, not just
// individually mocked.
//
// Gated behind `//go:build integration` so `go test ./...` (and scaffold-time
// verification) stays Docker-free. Run with `make test-integration`.
package app

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"runtime"
	"testing"
	"time"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/modules/postgres"
	"github.com/testcontainers/testcontainers-go/wait"

	"{{MODULE}}/internal/shared/config"
)

func migrationsDir(t *testing.T) string {
	t.Helper()
	_, file, _, _ := runtime.Caller(0)
	return filepath.Join(filepath.Dir(file), "..", "..", "db", "migrations")
}

func startPostgres(t *testing.T) string {
	t.Helper()
	ctx := context.Background()
	container, err := postgres.Run(ctx, "postgres:16-alpine",
		postgres.WithDatabase("app"),
		postgres.WithUsername("app"),
		postgres.WithPassword("app"),
		testcontainers.WithWaitStrategy(
			wait.ForLog("database system is ready to accept connections").
				WithOccurrence(2).WithStartupTimeout(60*time.Second)),
	)
	if err != nil {
		t.Fatalf("start postgres: %v", err)
	}
	t.Cleanup(func() { _ = testcontainers.TerminateContainer(container) })

	dsn, err := container.ConnectionString(ctx, "sslmode=disable")
	if err != nil {
		t.Fatalf("connection string: %v", err)
	}

	m, err := migrate.New("file://"+migrationsDir(t), dsn)
	if err != nil {
		t.Fatalf("migrate init: %v", err)
	}
	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		t.Fatalf("migrate up: %v", err)
	}
	_, _ = m.Close()
	return dsn
}

type client struct {
	t   *testing.T
	url string
	hc  *http.Client
}

func (c *client) do(method, path, token string, body any) (int, map[string]any) {
	c.t.Helper()
	var reader io.Reader
	if body != nil {
		b, _ := json.Marshal(body)
		reader = bytes.NewReader(b)
	}
	req, err := http.NewRequest(method, c.url+path, reader)
	if err != nil {
		c.t.Fatal(err)
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	resp, err := c.hc.Do(req)
	if err != nil {
		c.t.Fatal(err)
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	var decoded map[string]any
	if len(raw) > 0 {
		_ = json.Unmarshal(raw, &decoded)
	}
	return resp.StatusCode, decoded
}

func TestGoldenPath(t *testing.T) {
	dsn := startPostgres(t)
	t.Setenv("DATABASE_URL", dsn)
	t.Setenv("JWT_SECRET", "integration-test-secret")

	cfg, err := config.Load()
	if err != nil {
		t.Fatalf("config: %v", err)
	}
	pool, err := pgxpool.New(context.Background(), dsn)
	if err != nil {
		t.Fatalf("pool: %v", err)
	}
	t.Cleanup(pool.Close)

	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	srv := httptest.NewServer(Build(pool, cfg, logger, nil))
	t.Cleanup(srv.Close)
	c := &client{t: t, url: srv.URL, hc: srv.Client()}

	// signup
	status, body := c.do(http.MethodPost, "/v1/users", "", map[string]any{
		"email": "author@example.com", "name": "author", "password": "password123",
	})
	if status != http.StatusCreated {
		t.Fatalf("signup: status %d body %v", status, body)
	}
	authorID, _ := body["id"].(string)
	if authorID == "" {
		t.Fatalf("signup returned no id: %v", body)
	}

	// login
	status, body = c.do(http.MethodPost, "/v1/auth/login", "", map[string]any{
		"email": "author@example.com", "password": "password123",
	})
	if status != http.StatusOK {
		t.Fatalf("login: status %d body %v", status, body)
	}
	token, _ := body["access_token"].(string)
	if token == "" {
		t.Fatalf("login returned no access_token: %v", body)
	}

	// create post
	status, body = c.do(http.MethodPost, "/v1/posts", token, map[string]any{"title": "Hello", "body": "World"})
	if status != http.StatusCreated {
		t.Fatalf("create post: status %d body %v", status, body)
	}
	postID, _ := body["id"].(string)
	version := int(body["version"].(float64))

	// list shows author_name (proves cross-module GetManyByIDs read composition)
	status, body = c.do(http.MethodGet, "/v1/posts", token, nil)
	if status != http.StatusOK {
		t.Fatalf("list posts: status %d body %v", status, body)
	}
	if name := findPostField(body, postID, "author_name"); name != "author" {
		t.Fatalf("author_name = %v, want author", name)
	}

	// stale version -> 409, never a silent overwrite (ADR §9.4)
	status, _ = c.do(http.MethodPatch, "/v1/posts/"+postID, token, map[string]any{"title": "stale", "version": version + 100})
	if status != http.StatusConflict {
		t.Fatalf("stale update: status %d, want 409", status)
	}

	// correct version -> 200, version increments
	status, body = c.do(http.MethodPatch, "/v1/posts/"+postID, token, map[string]any{"title": "Updated", "version": version})
	if status != http.StatusOK {
		t.Fatalf("update: status %d body %v", status, body)
	}
	if int(body["version"].(float64)) != version+1 {
		t.Fatalf("version = %v, want %d", body["version"], version+1)
	}

	// self-erase: soft delete + synchronous cross-module anonymize
	status, _ = c.do(http.MethodDelete, "/v1/users/"+authorID, token, nil)
	if status != http.StatusNoContent {
		t.Fatalf("erase: status %d, want 204", status)
	}

	// posts now show the author anonymized (NOT via a relay tick — a direct call)
	status, body = c.do(http.MethodGet, "/v1/posts", token, nil)
	if status != http.StatusOK {
		t.Fatalf("list after erase: status %d body %v", status, body)
	}
	if id := findPostField(body, postID, "author_id"); id != nil {
		t.Fatalf("author_id = %v, want nil after erase", id)
	}
	if name := findPostField(body, postID, "author_name"); name != nil {
		t.Fatalf("author_name = %v, want nil after erase", name)
	}

	// readiness reflects a live DB
	resp, err := srv.Client().Get(srv.URL + "/readyz")
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("/readyz status %d, want 200", resp.StatusCode)
	}
	_ = resp.Body.Close()
}

func findPostField(list map[string]any, id, field string) any {
	data, _ := list["data"].([]any)
	for _, item := range data {
		m, _ := item.(map[string]any)
		if m["id"] == id {
			return m[field]
		}
	}
	return "<post not found>"
}
