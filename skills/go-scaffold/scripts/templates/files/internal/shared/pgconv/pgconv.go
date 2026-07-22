// Package pgconv converts between pgx's pgtype.* scan types (what sqlc emits for
// nullable/uuid/timestamp columns) and the plain Go types the domain layer uses
// (string ids, time.Time, pointers for nullables). Keeping this in one place
// means the two module repositories don't each re-implement the conversions.
package pgconv

import (
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

// StringToUUID parses a UUID string into a pgtype.UUID. An empty or unparseable
// string yields an invalid (NULL) value — safe for nullable columns.
func StringToUUID(s string) pgtype.UUID {
	if s == "" {
		return pgtype.UUID{}
	}
	u, err := uuid.Parse(s)
	if err != nil {
		return pgtype.UUID{}
	}
	return pgtype.UUID{Bytes: u, Valid: true}
}

func StringPtrToUUID(s *string) pgtype.UUID {
	if s == nil {
		return pgtype.UUID{}
	}
	return StringToUUID(*s)
}

func UUIDToString(u pgtype.UUID) string {
	if !u.Valid {
		return ""
	}
	return uuid.UUID(u.Bytes).String()
}

// UUIDToStringPtr returns nil for a NULL uuid (e.g. an anonymized author_id).
func UUIDToStringPtr(u pgtype.UUID) *string {
	if !u.Valid {
		return nil
	}
	s := uuid.UUID(u.Bytes).String()
	return &s
}

func TimeToTimestamptz(t time.Time) pgtype.Timestamptz {
	return pgtype.Timestamptz{Time: t, Valid: true}
}

func TimestamptzToTime(t pgtype.Timestamptz) time.Time {
	if !t.Valid {
		return time.Time{}
	}
	return t.Time
}

func TimestamptzToTimePtr(t pgtype.Timestamptz) *time.Time {
	if !t.Valid {
		return nil
	}
	v := t.Time
	return &v
}

// StringPtrToText maps an optional string to pgtype.Text (NULL when nil) — used
// for partial-update params where a nil field means "leave unchanged".
func StringPtrToText(s *string) pgtype.Text {
	if s == nil {
		return pgtype.Text{}
	}
	return pgtype.Text{String: *s, Valid: true}
}

// NewUUIDv7 mints a time-sortable UUIDv7 string for a new row's primary key
// (ADR §8). Falls back to v4 only if the system clock read fails.
func NewUUIDv7() string {
	if v7, err := uuid.NewV7(); err == nil {
		return v7.String()
	}
	return uuid.NewString()
}
