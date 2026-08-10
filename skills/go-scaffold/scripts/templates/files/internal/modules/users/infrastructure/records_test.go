package infrastructure

import (
	"testing"
	"time"

	"{{MODULE}}/internal/modules/users/domain"
)

// Mapping is hand-written, so a field added to the entity and forgotten here
// disappears silently — the code compiles, the query runs, and the value is
// just gone. A round trip catches that without a database.
func TestUserRecordRoundTrip(t *testing.T) {
	now := time.Now().Truncate(time.Second)
	original := domain.User{
		ID:           7,
		Email:        "ada@example.com",
		PasswordHash: "$2a$10$hash",
		FullName:     "Ada Lovelace",
		Role:         "admin",
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	got := userRecordOf(&original).toDomain()
	if got != original {
		t.Errorf("round trip lost data:\n got  %+v\n want %+v", got, original)
	}
}

func TestRefreshTokenRecordRoundTrip(t *testing.T) {
	now := time.Now().Truncate(time.Second)
	original := domain.RefreshToken{
		ID:        3,
		UserID:    7,
		TokenHash: "abc123",
		Revoked:   true,
		ExpiresAt: now.Add(time.Hour),
		CreatedAt: now,
	}

	got := refreshTokenRecordOf(&original).toDomain()
	if got != original {
		t.Errorf("round trip lost data:\n got  %+v\n want %+v", got, original)
	}
}

// GORM pluralises the struct name unless TableName says otherwise, so without
// these the queries would target user_records / refresh_token_records — tables
// the migrations never create.
func TestTableNamesMatchTheMigrations(t *testing.T) {
	if got := (userRecord{}).TableName(); got != "users" {
		t.Errorf("userRecord table = %q, want users", got)
	}
	if got := (refreshTokenRecord{}).TableName(); got != "refresh_tokens" {
		t.Errorf("refreshTokenRecord table = %q, want refresh_tokens", got)
	}
}
