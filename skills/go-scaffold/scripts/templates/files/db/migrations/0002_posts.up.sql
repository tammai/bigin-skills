-- posts module schema (ADR §4.2). sqlc reads THIS file (only) to type the
-- posts module's generated queries.
CREATE SCHEMA IF NOT EXISTS posts;

CREATE TABLE posts.posts (
    id         uuid PRIMARY KEY,
    -- nullable — anonymized (set NULL) when the author is erased, via a direct
    -- synchronous call from users' erase use-case through posts' public surface.
    author_id  uuid,
    title      text NOT NULL,
    body       text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid,
    updated_by uuid,
    version    integer NOT NULL DEFAULT 1,   -- optimistic concurrency (ADR §9.4)
    deleted_at timestamptz
);
CREATE INDEX posts_author_idx ON posts.posts (author_id);
CREATE INDEX posts_created_idx ON posts.posts (created_at);
