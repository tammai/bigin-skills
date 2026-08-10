package application

import (
	"context"
	"testing"

	"{{MODULE}}/internal/shared/apperr"
	"{{MODULE}}/internal/shared/auth"
)

func TestLoginIssuesAUsableTokenPair(t *testing.T) {
	svc, _, _ := newTestService(t)
	seeded := seedUser(t, svc, "ada@example.com", "Sup3r$ecret")

	user, tokens, err := svc.Login(context.Background(), "  Ada@Example.COM ", "Sup3r$ecret")
	if err != nil {
		t.Fatalf("Login() error: %v", err)
	}
	if user.ID != seeded.ID {
		t.Errorf("logged in as %d, want %d", user.ID, seeded.ID)
	}
	if tokens.Access == "" || tokens.Refresh == "" {
		t.Fatal("Login() returned an empty token")
	}

	// The refresh token must be stored hashed, never raw.
	if _, err := svc.tokens.ByHash(context.Background(), auth.HashToken(tokens.Refresh)); err != nil {
		t.Errorf("the refresh token was not stored under its hash: %v", err)
	}
	if _, err := svc.tokens.ByHash(context.Background(), tokens.Refresh); err == nil {
		t.Error("the RAW refresh token is in storage — only its hash may be")
	}
}

// An unknown email and a wrong password must be indistinguishable, or login
// becomes an account-enumeration oracle.
func TestLoginGivesTheSameAnswerForUnknownUserAndWrongPassword(t *testing.T) {
	svc, _, _ := newTestService(t)
	seedUser(t, svc, "ada@example.com", "Sup3r$ecret")

	_, _, unknownErr := svc.Login(context.Background(), "nobody@example.com", "Sup3r$ecret")
	_, _, wrongErr := svc.Login(context.Background(), "ada@example.com", "WrongP4ss$")

	if unknownErr == nil || wrongErr == nil {
		t.Fatal("Login() succeeded where it must fail")
	}
	if apperr.KindOf(unknownErr) != apperr.KindUnauthorized || apperr.KindOf(wrongErr) != apperr.KindUnauthorized {
		t.Fatalf("kinds = %v / %v, want both KindUnauthorized", apperr.KindOf(unknownErr), apperr.KindOf(wrongErr))
	}
	if apperr.MessageOf(unknownErr) != apperr.MessageOf(wrongErr) {
		t.Errorf("the two messages differ (%q vs %q) — that difference enumerates accounts",
			apperr.MessageOf(unknownErr), apperr.MessageOf(wrongErr))
	}
}

// The rotation contract, and the reason refresh tokens are worth the table:
// the presented token dies the moment it is spent.
func TestRefreshRotatesAndDetectsAReplay(t *testing.T) {
	svc, _, _ := newTestService(t)
	seedUser(t, svc, "ada@example.com", "Sup3r$ecret")

	_, first, err := svc.Login(context.Background(), "ada@example.com", "Sup3r$ecret")
	if err != nil {
		t.Fatalf("Login() error: %v", err)
	}

	second, err := svc.Refresh(context.Background(), first.Refresh)
	if err != nil {
		t.Fatalf("Refresh() error: %v", err)
	}
	if second.Refresh == first.Refresh {
		t.Fatal("Refresh() returned the same refresh token — it did not rotate")
	}

	// Replaying the spent token is the theft signal.
	if _, err := svc.Refresh(context.Background(), first.Refresh); err == nil {
		t.Fatal("the consumed refresh token still works — rotation is not revoking")
	} else if apperr.KindOf(err) != apperr.KindUnauthorized {
		t.Errorf("kind = %v, want KindUnauthorized", apperr.KindOf(err))
	}

	// The newly issued one must still be good.
	if _, err := svc.Refresh(context.Background(), second.Refresh); err != nil {
		t.Errorf("the rotated token was rejected: %v", err)
	}
}

func TestRefreshRejectsAnUnknownToken(t *testing.T) {
	svc, _, _ := newTestService(t)

	_, err := svc.Refresh(context.Background(), "not-a-real-token")
	if err == nil {
		t.Fatal("Refresh() accepted a token that was never issued")
	}
	if got := apperr.KindOf(err); got != apperr.KindUnauthorized {
		t.Errorf("kind = %v, want KindUnauthorized", got)
	}
}

func TestLogoutRevokesTheRefreshToken(t *testing.T) {
	svc, _, _ := newTestService(t)
	seedUser(t, svc, "ada@example.com", "Sup3r$ecret")

	_, tokens, err := svc.Login(context.Background(), "ada@example.com", "Sup3r$ecret")
	if err != nil {
		t.Fatalf("Login() error: %v", err)
	}
	if err := svc.Logout(context.Background(), tokens.Refresh); err != nil {
		t.Fatalf("Logout() error: %v", err)
	}
	if _, err := svc.Refresh(context.Background(), tokens.Refresh); err == nil {
		t.Fatal("the refresh token still works after logout")
	}
}

// Logging out with a token nobody recognises is a no-op, not an error: the
// caller's intent is satisfied, and reporting "no such token" would confirm
// which tokens exist.
func TestLogoutIsSilentAboutUnknownTokens(t *testing.T) {
	svc, _, _ := newTestService(t)

	if err := svc.Logout(context.Background(), "never-issued"); err != nil {
		t.Errorf("Logout() on an unknown token returned %v, want nil", err)
	}
}
