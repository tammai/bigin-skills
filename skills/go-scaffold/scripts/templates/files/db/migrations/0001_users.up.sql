-- users module schema (ADR §4.2: one Postgres schema per module, no
-- cross-schema FKs). sqlc reads THIS file (only) to type the users module's
-- generated queries.
CREATE SCHEMA IF NOT EXISTS users;

-- Audit + soft-delete columns are on every domain table by convention (ADR §8):
-- created_at/updated_at, a `version` row-version for optimistic concurrency,
-- created_by/updated_by (bare uuids — never cross-schema FKs), and deleted_at.
-- id is UUIDv7 generated in Go (uuid.NewV7()) and passed in on insert — NOT a
-- DB default, so ids stay time-sortable without a Postgres 18 uuidv7().
CREATE TABLE users.users (
    id            uuid PRIMARY KEY,
    email         text NOT NULL,
    name          text NOT NULL,
    password_hash text NOT NULL,
    -- text[] (not jsonb): pgx maps it straight to []string, no marshal step.
    roles         text[] NOT NULL DEFAULT ARRAY['user'],
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    created_by    uuid,
    updated_by    uuid,
    version       integer NOT NULL DEFAULT 1,
    deleted_at    timestamptz
);
-- Soft delete turns unique constraints into PARTIAL unique indexes (ADR §8),
-- or a soft-deleted row would block re-creating its replacement.
CREATE UNIQUE INDEX users_email_active_uq ON users.users (email) WHERE deleted_at IS NULL;

-- Refresh-token rotation lineage. token_hash is sha256 (a refresh token is a
-- 256-bit random value — nothing to brute-force; a slow hash only adds latency).
-- Reusing a revoked token in a family is a theft signal → revoke the family.
CREATE TABLE users.refresh_tokens (
    id             uuid PRIMARY KEY,
    user_id        uuid NOT NULL,
    token_hash     text NOT NULL,
    family_id      uuid NOT NULL,
    revoked_at     timestamptz,
    replaced_by_id uuid,
    expires_at     timestamptz NOT NULL,
    created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX refresh_tokens_hash_idx ON users.refresh_tokens (token_hash);
CREATE INDEX refresh_tokens_user_idx ON users.refresh_tokens (user_id);
