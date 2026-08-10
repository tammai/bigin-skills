package application

import (
	"context"
	"fmt"
	"testing"

	"{{MODULE}}/internal/shared/apperr"
	"{{MODULE}}/internal/shared/auth"
)

func TestListUsersPaginates(t *testing.T) {
	svc, _, _ := newTestService(t)
	for i := range 5 {
		seedUser(t, svc, fmt.Sprintf("user%d@example.com", i), "Sup3r$ecret")
	}

	page, err := svc.ListUsers(context.Background(), 2, 2)
	if err != nil {
		t.Fatalf("ListUsers() error: %v", err)
	}
	if page.Total != 5 {
		t.Errorf("Total = %d, want 5", page.Total)
	}
	if len(page.Users) != 2 {
		t.Fatalf("got %d users, want 2", len(page.Users))
	}
	if page.Users[0].Email != "user2@example.com" {
		t.Errorf("first user on page 2 = %q, want user2@example.com", page.Users[0].Email)
	}
}

// The contract declares min/max on these query parameters but the generated
// router does not enforce them, so an unclamped limit reaches the database as
// written. Clamping belongs here, not in the handler.
func TestListUsersClampsHostileParameters(t *testing.T) {
	svc, _, _ := newTestService(t)
	seedUser(t, svc, "ada@example.com", "Sup3r$ecret")

	cases := []struct {
		name      string
		page      int
		limit     int
		wantPage  int
		wantLimit int
	}{
		{"zero page", 0, 10, 1, 10},
		{"negative page", -3, 10, 1, 10},
		{"zero limit", 1, 0, 1, defaultPageLimit},
		{"absurd limit", 1, 1_000_000, 1, defaultPageLimit},
		{"limit at the cap", 1, maxPageLimit, 1, maxPageLimit},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := svc.ListUsers(context.Background(), tc.page, tc.limit)
			if err != nil {
				t.Fatalf("ListUsers() error: %v", err)
			}
			if got.Page != tc.wantPage || got.Limit != tc.wantLimit {
				t.Errorf("page/limit = %d/%d, want %d/%d", got.Page, got.Limit, tc.wantPage, tc.wantLimit)
			}
		})
	}
}

func TestChangeRolePromotes(t *testing.T) {
	svc, _, _ := newTestService(t)
	admin := seedUser(t, svc, "admin@example.com", "Sup3r$ecret")
	target := seedUser(t, svc, "ada@example.com", "Sup3r$ecret")

	updated, err := svc.ChangeRole(context.Background(), admin.ID, target.ID, auth.RoleAdmin)
	if err != nil {
		t.Fatalf("ChangeRole() error: %v", err)
	}
	if updated.Role != auth.RoleAdmin {
		t.Errorf("Role = %q, want admin", updated.Role)
	}

	// The change has to be persisted, not just returned.
	reloaded, err := svc.Profile(context.Background(), target.ID)
	if err != nil {
		t.Fatalf("Profile() error: %v", err)
	}
	if reloaded.Role != auth.RoleAdmin {
		t.Error("the role change was not saved")
	}
}

// Self-demotion can leave a system with zero admins and no API path back in.
func TestChangeRoleRefusesSelfDemotion(t *testing.T) {
	svc, _, _ := newTestService(t)
	admin := seedUser(t, svc, "admin@example.com", "Sup3r$ecret")

	_, err := svc.ChangeRole(context.Background(), admin.ID, admin.ID, auth.RoleUser)
	if err == nil {
		t.Fatal("ChangeRole() let an admin demote themselves")
	}
	if got := apperr.KindOf(err); got != apperr.KindInvalid {
		t.Errorf("kind = %v, want KindInvalid", got)
	}

	// Re-affirming your own admin role is harmless and must still work.
	if _, err := svc.ChangeRole(context.Background(), admin.ID, admin.ID, auth.RoleAdmin); err != nil {
		t.Errorf("ChangeRole(self, admin) = %v, want nil", err)
	}
}

func TestChangeRoleRejectsAnUnknownRole(t *testing.T) {
	svc, _, _ := newTestService(t)
	admin := seedUser(t, svc, "admin@example.com", "Sup3r$ecret")
	target := seedUser(t, svc, "ada@example.com", "Sup3r$ecret")

	if _, err := svc.ChangeRole(context.Background(), admin.ID, target.ID, "superuser"); err == nil {
		t.Fatal("ChangeRole() accepted a role outside the vocabulary")
	}
}

func TestDeleteUser(t *testing.T) {
	svc, _, _ := newTestService(t)
	admin := seedUser(t, svc, "admin@example.com", "Sup3r$ecret")
	target := seedUser(t, svc, "ada@example.com", "Sup3r$ecret")

	if err := svc.DeleteUser(context.Background(), admin.ID, target.ID); err != nil {
		t.Fatalf("DeleteUser() error: %v", err)
	}
	if _, err := svc.Profile(context.Background(), target.ID); apperr.KindOf(err) != apperr.KindNotFound {
		t.Error("the user is still there after DeleteUser")
	}
}

func TestDeleteUserRefusesSelfDeletion(t *testing.T) {
	svc, _, _ := newTestService(t)
	admin := seedUser(t, svc, "admin@example.com", "Sup3r$ecret")

	if err := svc.DeleteUser(context.Background(), admin.ID, admin.ID); err == nil {
		t.Fatal("DeleteUser() let an admin delete their own account")
	}
}

// Deleting something that isn't there is a 404, not a cheerful 200 that tells
// the caller a user was removed when none was.
func TestDeleteUserReportsAMissingTarget(t *testing.T) {
	svc, _, _ := newTestService(t)
	admin := seedUser(t, svc, "admin@example.com", "Sup3r$ecret")

	err := svc.DeleteUser(context.Background(), admin.ID, 9999)
	if got := apperr.KindOf(err); got != apperr.KindNotFound {
		t.Errorf("kind = %v, want KindNotFound", got)
	}
}
