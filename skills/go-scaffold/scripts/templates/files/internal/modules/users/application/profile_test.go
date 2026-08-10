package application

import (
	"context"
	"testing"

	"{{MODULE}}/internal/shared/apperr"
)

func TestProfileReturnsTheCaller(t *testing.T) {
	svc, _, _ := newTestService(t)
	seeded := seedUser(t, svc, "ada@example.com", "Sup3r$ecret")

	user, err := svc.Profile(context.Background(), seeded.ID)
	if err != nil {
		t.Fatalf("Profile() error: %v", err)
	}
	if user.Email != "ada@example.com" {
		t.Errorf("Email = %q, want ada@example.com", user.Email)
	}
}

func TestProfileReportsAMissingUser(t *testing.T) {
	svc, _, _ := newTestService(t)

	_, err := svc.Profile(context.Background(), 404)
	if got := apperr.KindOf(err); got != apperr.KindNotFound {
		t.Errorf("kind = %v, want KindNotFound", got)
	}
}

func TestUpdateProfileSanitizesAndPersists(t *testing.T) {
	svc, _, _ := newTestService(t)
	seeded := seedUser(t, svc, "ada@example.com", "Sup3r$ecret")

	name := "  Grace  <b>Hopper</b> "
	updated, err := svc.UpdateProfile(context.Background(), seeded.ID, &name)
	if err != nil {
		t.Fatalf("UpdateProfile() error: %v", err)
	}
	if updated.FullName != "Grace Hopper" {
		t.Errorf("FullName = %q, want the sanitised form", updated.FullName)
	}

	reloaded, err := svc.Profile(context.Background(), seeded.ID)
	if err != nil {
		t.Fatalf("Profile() error: %v", err)
	}
	if reloaded.FullName != "Grace Hopper" {
		t.Error("the profile update was not persisted")
	}
}

// nil means "the client did not send this field", which is not the same as
// sending an empty one — an omitted optional field must leave the record alone.
func TestUpdateProfileWithNoFieldsIsANoOp(t *testing.T) {
	svc, _, _ := newTestService(t)
	seeded := seedUser(t, svc, "ada@example.com", "Sup3r$ecret")

	updated, err := svc.UpdateProfile(context.Background(), seeded.ID, nil)
	if err != nil {
		t.Fatalf("UpdateProfile() error: %v", err)
	}
	if updated.FullName != seeded.FullName {
		t.Errorf("FullName = %q, want it unchanged at %q", updated.FullName, seeded.FullName)
	}
}

// Email and role are not editable here. This test is a tripwire: if someone
// widens UpdateProfile later, it should be a deliberate change to this
// assertion, not a silent side effect.
func TestUpdateProfileCannotChangeEmailOrRole(t *testing.T) {
	svc, _, _ := newTestService(t)
	seeded := seedUser(t, svc, "ada@example.com", "Sup3r$ecret")

	name := "Grace Hopper"
	updated, err := svc.UpdateProfile(context.Background(), seeded.ID, &name)
	if err != nil {
		t.Fatalf("UpdateProfile() error: %v", err)
	}
	if updated.Email != seeded.Email {
		t.Errorf("Email changed to %q — profile updates must not touch it", updated.Email)
	}
	if updated.Role != seeded.Role {
		t.Errorf("Role changed to %q — privilege must not be self-service", updated.Role)
	}
}
