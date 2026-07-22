-- sqlc queries for users.refresh_tokens (no soft delete on this table —
-- lifecycle is revoked_at/expires_at, not deleted_at).

-- name: CreateRefreshToken :one
INSERT INTO users.refresh_tokens (id, user_id, token_hash, family_id, expires_at)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: GetRefreshTokenByHash :one
SELECT * FROM users.refresh_tokens
WHERE token_hash = $1;

-- name: RevokeRefreshToken :execrows
-- Conditional on the token still being live. The `AND revoked_at IS NULL` guard
-- plus the affected-row count is the atomic serialization point for concurrent
-- refresh rotations: only ONE caller flips revoked_at from NULL (1 row), any
-- racing caller gets 0 rows and must abort instead of minting a second child
-- token (closes the refresh TOCTOU race). Idempotent for logout too — a
-- re-presented already-revoked token updates 0 rows and is a harmless no-op.
UPDATE users.refresh_tokens
SET revoked_at = now(), replaced_by_id = $2
WHERE id = $1 AND revoked_at IS NULL;

-- name: RevokeRefreshTokenFamily :exec
-- Reuse of an already-revoked token in a family is a theft signal — nuke the
-- whole live lineage.
UPDATE users.refresh_tokens
SET revoked_at = now()
WHERE family_id = $1 AND revoked_at IS NULL;
