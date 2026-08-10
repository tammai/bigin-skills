package application

import (
	"context"
	"errors"
	"testing"

	"{{MODULE}}/internal/shared/apperr"
	"{{MODULE}}/internal/shared/auth"
)

func TestSignUpStoresANormalisedUser(t *testing.T) {
	svc, _, _ := newTestService(t)

	user, err := svc.SignUp(context.Background(), SignUpInput{
		Email:    "Ada@Example.COM",
		Password: "Sup3r$ecret",
		FullName: "Ada Lovelace",
	})
	if err != nil {
		t.Fatalf("SignUp() error: %v", err)
	}

	if user.Email != "ada@example.com" {
		t.Errorf("Email = %q, want the normalised form", user.Email)
	}
	if user.Role != auth.RoleUser {
		t.Errorf("Role = %q, want %q", user.Role, auth.RoleUser)
	}
	if user.PasswordHash == "Sup3r$ecret" || user.PasswordHash == "" {
		t.Error("the password must be stored as a hash")
	}
	if user.ID == 0 {
		t.Error("the repository did not assign an ID")
	}
}

// Case-only differences must collide. Checking the raw input instead of the
// normalised one is how a second account sneaks in and then trips the unique
// index with a 500 instead of a clean 409.
func TestSignUpRejectsADuplicateEmailRegardlessOfCase(t *testing.T) {
	svc, _, _ := newTestService(t)
	seedUser(t, svc, "Ada@Example.COM", "Sup3r$ecret")

	_, err := svc.SignUp(context.Background(), SignUpInput{
		Email:    "ada@example.com",
		Password: "An0ther$ecret",
		FullName: "Ada Again",
	})
	if err == nil {
		t.Fatal("SignUp() accepted a duplicate email differing only by case")
	}
	if got := apperr.KindOf(err); got != apperr.KindConflict {
		t.Errorf("kind = %v, want KindConflict", got)
	}
}

func TestSignUpEnforcesThePasswordPolicy(t *testing.T) {
	svc, _, _ := newTestService(t)

	_, err := svc.SignUp(context.Background(), SignUpInput{
		Email:    "ada@example.com",
		Password: "weakpass",
		FullName: "Ada Lovelace",
	})
	if err == nil {
		t.Fatal("SignUp() accepted a password with no uppercase, digit, or special character")
	}
	if got := apperr.KindOf(err); got != apperr.KindInvalid {
		t.Errorf("kind = %v, want KindInvalid", got)
	}
}

// A broken lookup is not a free pass. If the ByEmail failure were swallowed,
// signup would proceed and create a duplicate whenever the database hiccuped.
func TestSignUpPropagatesALookupFailure(t *testing.T) {
	svc, users, _ := newTestService(t)
	users.failNext = apperr.Internal("Database error", errors.New("connection refused"))

	_, err := svc.SignUp(context.Background(), SignUpInput{
		Email:    "ada@example.com",
		Password: "Sup3r$ecret",
		FullName: "Ada Lovelace",
	})
	if err == nil {
		t.Fatal("SignUp() ignored a repository failure during the duplicate check")
	}
	if got := apperr.KindOf(err); got != apperr.KindInternal {
		t.Errorf("kind = %v, want KindInternal", got)
	}
}
