package domain

import (
	"strings"
	"testing"
	"time"

	"{{MODULE}}/internal/shared/apperr"
	"{{MODULE}}/internal/shared/auth"
)

func TestNewUserAppliesInvariants(t *testing.T) {
	u, err := NewUser("  Ada@Example.COM ", "hashed", "<b>Ada</b>  Lovelace")
	if err != nil {
		t.Fatalf("NewUser() error: %v", err)
	}
	if u.Email != "ada@example.com" {
		t.Errorf("Email = %q — it must be normalised, or case creates duplicate accounts", u.Email)
	}
	if u.FullName != "Ada Lovelace" {
		t.Errorf("FullName = %q, want the sanitised form", u.FullName)
	}
	if u.Role != auth.RoleUser {
		t.Errorf("Role = %q, want %q — the role is never taken from the caller", u.Role, auth.RoleUser)
	}
}

func TestNewUserRejectsMissingFields(t *testing.T) {
	cases := []struct {
		name     string
		email    string
		hash     string
		fullName string
		wantKind apperr.Kind
	}{
		{"blank email", "   ", "hashed", "Ada", apperr.KindInvalid},
		{"name that is only markup", "ada@example.com", "hashed", "<script></script>", apperr.KindInvalid},
		// A missing hash is a programming error, not bad input — it must not
		// come back as a 400 inviting the client to retry.
		{"missing password hash", "ada@example.com", "", "Ada", apperr.KindInternal},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := NewUser(tc.email, tc.hash, tc.fullName)
			if err == nil {
				t.Fatal("NewUser() accepted invalid input")
			}
			if got := apperr.KindOf(err); got != tc.wantKind {
				t.Errorf("kind = %v, want %v", got, tc.wantKind)
			}
		})
	}
}

func TestChangeRoleRejectsUnknownRoles(t *testing.T) {
	u := &User{Role: auth.RoleUser}

	if err := u.ChangeRole("superuser"); err == nil {
		t.Fatal("ChangeRole accepted a role no authorization check will ever match")
	}
	if u.Role != auth.RoleUser {
		t.Errorf("Role = %q — a rejected change must not mutate the entity", u.Role)
	}
	if err := u.ChangeRole(auth.RoleAdmin); err != nil {
		t.Fatalf("ChangeRole(admin) error: %v", err)
	}
	if u.Role != auth.RoleAdmin {
		t.Errorf("Role = %q, want admin", u.Role)
	}
}

func TestRenameSanitizes(t *testing.T) {
	u := &User{FullName: "Ada"}

	if err := u.Rename("  Grace   <i>Hopper</i> "); err != nil {
		t.Fatalf("Rename() error: %v", err)
	}
	if u.FullName != "Grace Hopper" {
		t.Errorf("FullName = %q, want the sanitised form", u.FullName)
	}
	if err := u.Rename("<b></b>"); err == nil {
		t.Error("Rename accepted a name that sanitises to nothing")
	}
}

func TestValidatePassword(t *testing.T) {
	cases := []struct {
		password string
		accepted bool
		missing  string
	}{
		{"Sup3r$ecret", true, ""},
		{"Short1$A", true, ""}, // exactly 8, all four classes
		{"Ab1$", false, "8 characters"},
		{"alllower1$", false, "uppercase"},
		{"ALLUPPER1$", false, "lowercase"},
		{"NoDigits$$", false, "digit"},
		{"NoSpecial1A", false, "special"},
	}
	for _, tc := range cases {
		t.Run(tc.password, func(t *testing.T) {
			err := ValidatePassword(tc.password)
			if tc.accepted {
				if err != nil {
					t.Fatalf("ValidatePassword = %v, want accepted", err)
				}
				return
			}
			if err == nil {
				t.Fatalf("accepted a password missing its %s requirement", tc.missing)
			}
			// The message has to name the missing class — "too weak" gives the
			// user nothing to act on.
			if !strings.Contains(err.Error(), tc.missing) {
				t.Errorf("error = %q, want it to name %q", err.Error(), tc.missing)
			}
		})
	}
}

func TestRefreshTokenUsable(t *testing.T) {
	now := time.Now()

	fresh := &RefreshToken{ExpiresAt: now.Add(time.Hour)}
	if !fresh.Usable(now) {
		t.Error("a fresh token should be usable")
	}

	expired := &RefreshToken{ExpiresAt: now.Add(-time.Second)}
	if expired.Usable(now) {
		t.Error("an expired token must not be usable")
	}

	// The replay case: rotation revoked it on first use.
	replayed := &RefreshToken{Revoked: true, ExpiresAt: now.Add(time.Hour)}
	if replayed.Usable(now) {
		t.Error("a revoked token must not be usable — this is the replay detection")
	}
}
