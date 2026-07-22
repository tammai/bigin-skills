-- sqlc queries for users.users. SOFT DELETE: every read here applies
-- `deleted_at IS NULL` by hand — sqlc has ONE query surface (this file), so
-- there is no builder-vs-raw split that could drift (the bug class the ADR §8
-- soft-delete rule guards against). Erasure (SoftDeleteUser) is a deliberate
-- write to deleted_at, not a filtered read.
-- id is supplied by the caller (UUIDv7 from Go), not defaulted.

-- name: CreateUser :one
INSERT INTO users.users (id, email, name, password_hash, roles, created_by)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: GetUserByID :one
SELECT * FROM users.users
WHERE id = $1 AND deleted_at IS NULL;

-- name: GetUserByEmail :one
SELECT * FROM users.users
WHERE email = $1 AND deleted_at IS NULL;

-- name: GetUsersByIDs :many
SELECT * FROM users.users
WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL;

-- name: ListUsers :many
-- Offset pagination (fixed newest-first sort). Simple and bounded for a
-- scaffold; cursor/keyset pagination is a documented later upgrade.
SELECT * FROM users.users
WHERE deleted_at IS NULL
ORDER BY created_at DESC, id DESC
LIMIT $1 OFFSET $2;

-- name: SoftDeleteUser :one
-- Erase (ADR §8 soft delete): set deleted_at rather than DELETE. Returns the id
-- only when a live row was actually flagged (0 rows → already gone / not found).
UPDATE users.users
SET deleted_at = now(), updated_at = now(), updated_by = $2
WHERE id = $1 AND deleted_at IS NULL
RETURNING id;
