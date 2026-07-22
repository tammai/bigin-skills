// Command seed inserts a working dataset for local development (ADR §12): an
// admin user and one post. Idempotent — safe to re-run. It talks to Postgres
// directly (raw SQL) rather than through a module's internal repository, since
// cmd/ is outside every module's nested internal/ boundary by design.
package main

import (
	"context"
	"fmt"
	"os"

	"github.com/jackc/pgx/v5"

	"{{MODULE}}/internal/shared/auth"
	"{{MODULE}}/internal/shared/pgconv"
)

const (
	seedEmail    = "admin@example.com"
	seedPassword = "changeme123"
)

func main() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		fmt.Fprintln(os.Stderr, "DATABASE_URL is required")
		os.Exit(1)
	}

	ctx := context.Background()
	conn, err := pgx.Connect(ctx, dsn)
	if err != nil {
		fmt.Fprintln(os.Stderr, "connect:", err)
		os.Exit(1)
	}
	defer conn.Close(ctx)

	hasher := auth.NewArgon2Hasher(19456, 2, 1)

	var adminID string
	err = conn.QueryRow(ctx, `SELECT id FROM users.users WHERE email = $1 AND deleted_at IS NULL`, seedEmail).Scan(&adminID)
	if err == pgx.ErrNoRows {
		hash, herr := hasher.Hash(seedPassword)
		if herr != nil {
			fmt.Fprintln(os.Stderr, "hash:", herr)
			os.Exit(1)
		}
		adminID = pgconv.NewUUIDv7()
		if _, err = conn.Exec(ctx,
			`INSERT INTO users.users (id, email, name, password_hash, roles) VALUES ($1, $2, $3, $4, $5)`,
			adminID, seedEmail, "Admin", hash, []string{auth.RoleAdmin}); err != nil {
			fmt.Fprintln(os.Stderr, "insert user:", err)
			os.Exit(1)
		}
	} else if err != nil {
		fmt.Fprintln(os.Stderr, "lookup admin:", err)
		os.Exit(1)
	}

	var postCount int
	if err = conn.QueryRow(ctx, `SELECT count(*) FROM posts.posts WHERE author_id = $1`, adminID).Scan(&postCount); err != nil {
		fmt.Fprintln(os.Stderr, "count posts:", err)
		os.Exit(1)
	}
	if postCount == 0 {
		if _, err = conn.Exec(ctx,
			`INSERT INTO posts.posts (id, author_id, title, body, created_by) VALUES ($1, $2, $3, $4, $2)`,
			pgconv.NewUUIDv7(), adminID, "Welcome", "This is a seeded post."); err != nil {
			fmt.Fprintln(os.Stderr, "insert post:", err)
			os.Exit(1)
		}
	}

	fmt.Printf("seed complete: %s / %s\n", seedEmail, seedPassword)
}
