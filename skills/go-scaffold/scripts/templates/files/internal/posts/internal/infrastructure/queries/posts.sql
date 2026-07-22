-- sqlc queries for posts.posts. SOFT DELETE: every non-erasure read/update
-- applies `deleted_at IS NULL` by hand. sqlc's single query surface (this file)
-- is why there's no second path that could forget the filter (ADR §8).
-- id is supplied by the caller (UUIDv7 from Go).

-- name: CreatePost :one
INSERT INTO posts.posts (id, author_id, title, body, created_by)
VALUES ($1, $2, $3, $4, $2)
RETURNING *;

-- name: GetPostByID :one
SELECT * FROM posts.posts
WHERE id = $1 AND deleted_at IS NULL;

-- name: ListPosts :many
-- Offset pagination (fixed newest-first sort).
SELECT * FROM posts.posts
WHERE deleted_at IS NULL
ORDER BY created_at DESC, id DESC
LIMIT $1 OFFSET $2;

-- name: UpdatePostWithVersion :one
-- Optimistic concurrency (ADR §9.4): the WHERE on version = @expected_version is
-- the atomic guard. A concurrent editor's update between the use-case's read and
-- this call makes this match 0 rows (pgx.ErrNoRows), never a lost-update
-- overwrite — the use-case maps that to a 409.
UPDATE posts.posts
SET title = COALESCE(sqlc.narg('title'), title),
    body = COALESCE(sqlc.narg('body'), body),
    updated_at = now(),
    updated_by = @updated_by,
    version = version + 1
WHERE id = @id AND version = @expected_version AND deleted_at IS NULL
RETURNING *;

-- name: AnonymizeAuthor :exec
-- Consuming half of the cross-module erase (ADR §8): scrub an erased user's
-- authorship. Called synchronously from users' erase use-case through posts'
-- public surface. No deleted_at filter — erasure must reach soft-deleted posts.
UPDATE posts.posts
SET author_id = NULL, updated_at = now()
WHERE author_id = $1;
