package application

import (
	"context"
	"testing"
	"time"

	"{{MODULE}}/internal/shared/apperr"
	"{{MODULE}}/internal/shared/auth"
)

var sessionEpoch = time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC)

func TestCreateSessionStoresOnlyTheHash(t *testing.T) {
	svc, _, _, sessions := newTestServiceWithSessions(t)
	useClock(svc, sessionEpoch)
	seeded := seedUser(t, svc, "ada@example.com", "Sup3r$ecret")

	user, issued, err := svc.CreateSession(context.Background(), "  Ada@Example.COM ", "Sup3r$ecret")
	if err != nil {
		t.Fatalf("CreateSession() error: %v", err)
	}
	if user.ID != seeded.ID {
		t.Errorf("session for user %d, want %d", user.ID, seeded.ID)
	}
	if issued.Raw == "" {
		t.Fatal("CreateSession() returned an empty session ID")
	}
	if _, ok := sessions.byHash[auth.HashToken(issued.Raw)]; !ok {
		t.Error("the session was not stored under the hash of its ID")
	}
	if _, ok := sessions.byHash[issued.Raw]; ok {
		t.Error("the RAW session ID is in storage — only its hash may be")
	}
	// The cookie's Max-Age is derived from this, so it must be the absolute
	// expiry, not the idle one: the cookie outlives idle windows by design.
	if want := sessionEpoch.Add(testSessionPolicy.AbsoluteTTL); !issued.ExpiresAt.Equal(want) {
		t.Errorf("ExpiresAt = %v, want the absolute expiry %v", issued.ExpiresAt, want)
	}
}

// The web login must be exactly as enumeration-safe as the token login — it is
// the same check, and a second endpoint with a different answer would reopen
// the oracle the first one closed.
func TestCreateSessionGivesTheSameAnswerAsLogin(t *testing.T) {
	svc, _, _, sessions := newTestServiceWithSessions(t)
	seedUser(t, svc, "ada@example.com", "Sup3r$ecret")

	_, _, unknownErr := svc.CreateSession(context.Background(), "nobody@example.com", "Sup3r$ecret")
	_, _, wrongErr := svc.CreateSession(context.Background(), "ada@example.com", "WrongP4ss$")
	_, _, loginErr := svc.Login(context.Background(), "nobody@example.com", "Sup3r$ecret")

	for name, err := range map[string]error{"unknown": unknownErr, "wrong": wrongErr} {
		if apperr.KindOf(err) != apperr.KindUnauthorized {
			t.Errorf("%s: kind = %v, want KindUnauthorized", name, apperr.KindOf(err))
		}
		if apperr.MessageOf(err) != apperr.MessageOf(loginErr) {
			t.Errorf("%s: message %q differs from login's %q", name, apperr.MessageOf(err), apperr.MessageOf(loginErr))
		}
	}
	if len(sessions.byHash) != 0 {
		t.Errorf("%d sessions stored after failed logins, want 0", len(sessions.byHash))
	}
}

// The role comes from the users table on every request, never from the row the
// session was created with — so a demotion takes effect on the next request,
// not at the next login.
func TestResolveSessionReadsTheRoleFresh(t *testing.T) {
	svc, users, _, _ := newTestServiceWithSessions(t)
	useClock(svc, sessionEpoch)
	seeded := seedUser(t, svc, "ada@example.com", "Sup3r$ecret")

	_, issued, err := svc.CreateSession(context.Background(), "ada@example.com", "Sup3r$ecret")
	if err != nil {
		t.Fatalf("CreateSession() error: %v", err)
	}

	claims, err := svc.ResolveSession(context.Background(), issued.Raw)
	if err != nil {
		t.Fatalf("ResolveSession() error: %v", err)
	}
	if claims.UserID != seeded.ID || claims.Role != auth.RoleUser {
		t.Errorf("claims = %+v, want user %d with role user", claims, seeded.ID)
	}

	users.byID[seeded.ID].Role = auth.RoleAdmin
	claims, err = svc.ResolveSession(context.Background(), issued.Raw)
	if err != nil {
		t.Fatalf("ResolveSession() error: %v", err)
	}
	if claims.Role != auth.RoleAdmin {
		t.Errorf("role = %q after promotion, want admin — the role was cached", claims.Role)
	}
}

func TestResolveSessionExpiresWhenIdle(t *testing.T) {
	svc, _, _, sessions := newTestServiceWithSessions(t)
	clock := useClock(svc, sessionEpoch)
	seedUser(t, svc, "ada@example.com", "Sup3r$ecret")

	_, issued, err := svc.CreateSession(context.Background(), "ada@example.com", "Sup3r$ecret")
	if err != nil {
		t.Fatalf("CreateSession() error: %v", err)
	}

	clock.advance(testSessionPolicy.IdleTTL)
	_, err = svc.ResolveSession(context.Background(), issued.Raw)
	if apperr.KindOf(err) != apperr.KindUnauthorized {
		t.Fatalf("idle session: err = %v, want KindUnauthorized", err)
	}
	// Deleting on sight keeps the table from filling with dead rows that only
	// a cleanup job would otherwise remove.
	if _, ok := sessions.byHash[auth.HashToken(issued.Raw)]; ok {
		t.Error("the expired session row was not deleted")
	}
}

// Activity slides the idle window, but never past the absolute one. A session
// used every day — by its owner or by whoever stole the cookie — still ends.
func TestResolveSessionExpiresAtTheAbsoluteLimitDespiteActivity(t *testing.T) {
	svc, _, _, _ := newTestServiceWithSessions(t)
	clock := useClock(svc, sessionEpoch)
	seedUser(t, svc, "ada@example.com", "Sup3r$ecret")

	_, issued, err := svc.CreateSession(context.Background(), "ada@example.com", "Sup3r$ecret")
	if err != nil {
		t.Fatalf("CreateSession() error: %v", err)
	}

	end := sessionEpoch.Add(testSessionPolicy.AbsoluteTTL)
	for clock.advance(24 * time.Hour); clock.t.Before(end); clock.advance(24 * time.Hour) {
		if _, err := svc.ResolveSession(context.Background(), issued.Raw); err != nil {
			t.Fatalf("daily use at %v was rejected: %v", clock.t, err)
		}
	}

	_, err = svc.ResolveSession(context.Background(), issued.Raw)
	if apperr.KindOf(err) != apperr.KindUnauthorized {
		t.Fatalf("at the absolute limit: err = %v, want KindUnauthorized", err)
	}
}

func TestResolveSessionSlidesOnlyAfterAnHour(t *testing.T) {
	svc, _, _, sessions := newTestServiceWithSessions(t)
	clock := useClock(svc, sessionEpoch)
	seedUser(t, svc, "ada@example.com", "Sup3r$ecret")

	_, issued, err := svc.CreateSession(context.Background(), "ada@example.com", "Sup3r$ecret")
	if err != nil {
		t.Fatalf("CreateSession() error: %v", err)
	}
	hash := auth.HashToken(issued.Raw)

	clock.advance(30 * time.Minute)
	if _, err := svc.ResolveSession(context.Background(), issued.Raw); err != nil {
		t.Fatalf("ResolveSession() error: %v", err)
	}
	if sessions.activityWrites != 0 {
		t.Errorf("%d activity writes inside the slide interval, want 0", sessions.activityWrites)
	}

	clock.advance(31 * time.Minute)
	if _, err := svc.ResolveSession(context.Background(), issued.Raw); err != nil {
		t.Fatalf("ResolveSession() error: %v", err)
	}
	if sessions.activityWrites != 1 {
		t.Fatalf("%d activity writes after the interval, want 1", sessions.activityWrites)
	}
	if want := clock.t.Add(testSessionPolicy.IdleTTL); !sessions.byHash[hash].IdleExpiresAt.Equal(want) {
		t.Errorf("IdleExpiresAt = %v, want %v", sessions.byHash[hash].IdleExpiresAt, want)
	}
}

// A user deleted mid-session is cascaded out of the sessions table by the FK;
// even if the row survived a race, the user lookup turns it into a 401.
func TestResolveSessionRejectsADeletedUser(t *testing.T) {
	svc, users, _, _ := newTestServiceWithSessions(t)
	useClock(svc, sessionEpoch)
	seeded := seedUser(t, svc, "ada@example.com", "Sup3r$ecret")

	_, issued, err := svc.CreateSession(context.Background(), "ada@example.com", "Sup3r$ecret")
	if err != nil {
		t.Fatalf("CreateSession() error: %v", err)
	}
	delete(users.byID, seeded.ID)

	_, err = svc.ResolveSession(context.Background(), issued.Raw)
	if apperr.KindOf(err) != apperr.KindUnauthorized {
		t.Errorf("err = %v, want KindUnauthorized", err)
	}
}

// Unknown, expired and logged-out sessions must be indistinguishable to the
// caller, or the 401 tells an attacker which stolen cookies were once real.
func TestResolveSessionFailuresAreIndistinguishable(t *testing.T) {
	svc, _, _, _ := newTestServiceWithSessions(t)
	clock := useClock(svc, sessionEpoch)
	seedUser(t, svc, "ada@example.com", "Sup3r$ecret")

	_, expired, _ := svc.CreateSession(context.Background(), "ada@example.com", "Sup3r$ecret")
	_, loggedOut, _ := svc.CreateSession(context.Background(), "ada@example.com", "Sup3r$ecret")
	if err := svc.DeleteSession(context.Background(), loggedOut.Raw); err != nil {
		t.Fatalf("DeleteSession() error: %v", err)
	}
	_, unknownErr := svc.ResolveSession(context.Background(), "never-issued")
	_, loggedOutErr := svc.ResolveSession(context.Background(), loggedOut.Raw)
	clock.advance(testSessionPolicy.IdleTTL + time.Minute)
	_, expiredErr := svc.ResolveSession(context.Background(), expired.Raw)

	for name, err := range map[string]error{"logged out": loggedOutErr, "expired": expiredErr} {
		if apperr.KindOf(err) != apperr.KindUnauthorized || apperr.MessageOf(err) != apperr.MessageOf(unknownErr) {
			t.Errorf("%s: (%v, %q), want the unknown-session answer (%v, %q)",
				name, apperr.KindOf(err), apperr.MessageOf(err), apperr.KindOf(unknownErr), apperr.MessageOf(unknownErr))
		}
	}
}

// Logging out of a session nobody recognises is a no-op, not an error — the
// same rule, and the same reason, as refresh-token logout.
func TestDeleteSessionIsSilentAboutUnknownSessions(t *testing.T) {
	svc, _, _, _ := newTestServiceWithSessions(t)

	if err := svc.DeleteSession(context.Background(), "never-issued"); err != nil {
		t.Errorf("DeleteSession() on an unknown session returned %v, want nil", err)
	}
}

// A session abandoned without logout is only ever deleted when someone presents
// its cookie — which, for an abandoned one, is never. Logging in again prunes
// the user's dead rows, so they cannot accumulate forever.
func TestCreateSessionPrunesTheUsersExpiredSessions(t *testing.T) {
	svc, _, _, sessions := newTestServiceWithSessions(t)
	clock := useClock(svc, sessionEpoch)
	seedUser(t, svc, "ada@example.com", "Sup3r$ecret")
	seedUser(t, svc, "bob@example.com", "Sup3r$ecret")

	_, adaOld, _ := svc.CreateSession(context.Background(), "ada@example.com", "Sup3r$ecret")
	_, bobOld, _ := svc.CreateSession(context.Background(), "bob@example.com", "Sup3r$ecret")
	clock.advance(testSessionPolicy.IdleTTL + time.Minute)
	_, adaLive, _ := svc.CreateSession(context.Background(), "ada@example.com", "Sup3r$ecret")
	clock.advance(time.Minute)
	_, adaNew, err := svc.CreateSession(context.Background(), "ada@example.com", "Sup3r$ecret")
	if err != nil {
		t.Fatalf("CreateSession() error: %v", err)
	}

	if _, ok := sessions.byHash[auth.HashToken(adaOld.Raw)]; ok {
		t.Error("the user's expired session survived a new login")
	}
	for name, raw := range map[string]string{"live": adaLive.Raw, "new": adaNew.Raw} {
		if _, ok := sessions.byHash[auth.HashToken(raw)]; !ok {
			t.Errorf("the user's %s session was pruned — only expired ones may be", name)
		}
	}
	// Pruning is scoped to the user logging in; another user's rows are theirs.
	if _, ok := sessions.byHash[auth.HashToken(bobOld.Raw)]; !ok {
		t.Error("another user's session was pruned")
	}
}

// Pruning is housekeeping. If it fails, the login still succeeds.
func TestCreateSessionSucceedsWhenPruningFails(t *testing.T) {
	svc, _, _, sessions := newTestServiceWithSessions(t)
	seedUser(t, svc, "ada@example.com", "Sup3r$ecret")
	sessions.failPrune = apperr.Internal("Failed to prune sessions", nil)

	if _, _, err := svc.CreateSession(context.Background(), "ada@example.com", "Sup3r$ecret"); err != nil {
		t.Errorf("CreateSession() failed because pruning failed: %v", err)
	}
}
