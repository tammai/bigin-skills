package application

import (
	"context"
	"testing"
	"time"

	"{{MODULE}}/internal/shared/apierror"
	"{{MODULE}}/internal/shared/auth"
	"{{MODULE}}/internal/users/internal/domain"
)

func liveToken(overrides func(*domain.RefreshToken)) *domain.RefreshToken {
	t := &domain.RefreshToken{
		ID: "rt1", UserID: "u1", TokenHash: "h", FamilyID: "f1",
		ExpiresAt: time.Now().Add(24 * time.Hour), CreatedAt: time.Now(),
	}
	if overrides != nil {
		overrides(t)
	}
	return t
}

func TestLogin(t *testing.T) {
	// Timing side-channel guard (finding): the account-not-found branch must pay
	// the same argon2id Verify cost as the account-exists branch, so both call
	// the hasher's Verify exactly once and return the identical generic error.
	t.Run("rejects an unknown user and still runs a dummy verify (no timing oracle)", func(t *testing.T) {
		verifyCalls := 0
		var verifiedHash string
		users := &fakeUsers{findByEmailFn: func(context.Context, string) (*domain.User, error) { return nil, nil }}
		hasher := &fakeHasher{verifyFn: func(hash, _ string) (bool, error) { verifyCalls++; verifiedHash = hash; return false, nil }}
		s := NewService(users, &fakeTokens{}, hasher, 30)
		_, err := s.Login(context.Background(), "nobody@example.com", "x")
		assertCode(t, err, apierror.CodeInvalidCredentials)
		if verifyCalls != 1 {
			t.Fatalf("unknown-user branch called Verify %d times, want 1 (dummy verify pays the timing cost)", verifyCalls)
		}
		if verifiedHash != auth.DummyPasswordHash {
			t.Fatalf("dummy verify used hash %q, want auth.DummyPasswordHash", verifiedHash)
		}
	})

	t.Run("rejects a wrong password with exactly one verify (same as the unknown-user branch)", func(t *testing.T) {
		verifyCalls := 0
		users := &fakeUsers{findByEmailFn: func(context.Context, string) (*domain.User, error) {
			return &domain.User{ID: "u1", PasswordHash: "h", Roles: []string{auth.RoleUser}}, nil
		}}
		hasher := &fakeHasher{verifyFn: func(string, string) (bool, error) { verifyCalls++; return false, nil }}
		s := NewService(users, &fakeTokens{}, hasher, 30)
		_, err := s.Login(context.Background(), "a@example.com", "wrong")
		assertCode(t, err, apierror.CodeInvalidCredentials)
		if verifyCalls != 1 {
			t.Fatalf("wrong-password branch called Verify %d times, want 1", verifyCalls)
		}
	})

	t.Run("issues a refresh token on valid credentials", func(t *testing.T) {
		users := &fakeUsers{findByEmailFn: func(context.Context, string) (*domain.User, error) {
			return &domain.User{ID: "u1", PasswordHash: "h", Roles: []string{auth.RoleUser}}, nil
		}}
		hasher := &fakeHasher{verifyFn: func(string, string) (bool, error) { return true, nil }}
		var created CreateRefreshParams
		tokens := &fakeTokens{createFn: func(_ context.Context, p CreateRefreshParams) (domain.RefreshToken, error) {
			created = p
			return domain.RefreshToken{ID: "rt1"}, nil
		}}
		s := NewService(users, tokens, hasher, 30)

		res, err := s.Login(context.Background(), "a@example.com", "password123")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if res.Principal.Sub != "u1" || res.RefreshToken == "" {
			t.Fatalf("bad login result: %+v", res)
		}
		if created.TokenHash != auth.HashRefreshToken(res.RefreshToken) {
			t.Fatal("stored token hash must match the issued token")
		}
	})
}

func TestRefresh(t *testing.T) {
	t.Run("rejects an unknown token", func(t *testing.T) {
		tokens := &fakeTokens{findByHashFn: func(context.Context, string) (*domain.RefreshToken, error) { return nil, nil }}
		s := NewService(&fakeUsers{}, tokens, &fakeHasher{}, 30)
		_, err := s.Refresh(context.Background(), "nope")
		assertCode(t, err, apierror.CodeInvalidRefreshToken)
	})

	t.Run("revokes the whole family on reuse of a revoked token", func(t *testing.T) {
		revoked := time.Now()
		var revokedFamily string
		tokens := &fakeTokens{
			findByHashFn:   func(context.Context, string) (*domain.RefreshToken, error) { return liveToken(func(rt *domain.RefreshToken) { rt.RevokedAt = &revoked }), nil },
			revokeFamilyFn: func(_ context.Context, familyID string) error { revokedFamily = familyID; return nil },
		}
		s := NewService(&fakeUsers{}, tokens, &fakeHasher{}, 30)
		_, err := s.Refresh(context.Background(), "reused")
		assertCode(t, err, apierror.CodeInvalidRefreshToken)
		if revokedFamily != "f1" {
			t.Fatalf("expected family f1 revoked, got %q", revokedFamily)
		}
	})

	t.Run("rejects an expired token", func(t *testing.T) {
		tokens := &fakeTokens{findByHashFn: func(context.Context, string) (*domain.RefreshToken, error) {
			return liveToken(func(rt *domain.RefreshToken) { rt.ExpiresAt = time.Now().Add(-time.Minute) }), nil
		}}
		s := NewService(&fakeUsers{}, tokens, &fakeHasher{}, 30)
		_, err := s.Refresh(context.Background(), "expired")
		assertCode(t, err, apierror.CodeInvalidRefreshToken)
	})

	t.Run("rotates: new token in the same family, old one revoked before the child is minted", func(t *testing.T) {
		var revokedID string
		var replacedBy *string
		var created CreateRefreshParams
		var revokedBeforeCreate bool
		createSeen := false
		tokens := &fakeTokens{
			findByHashFn: func(context.Context, string) (*domain.RefreshToken, error) { return liveToken(nil), nil },
			// Revoke must run (and succeed) BEFORE Create — record the ordering.
			revokeFn: func(_ context.Context, id string, r *string) (bool, error) {
				revokedID = id
				replacedBy = r
				revokedBeforeCreate = !createSeen
				return true, nil
			},
			createFn: func(_ context.Context, p CreateRefreshParams) (domain.RefreshToken, error) {
				createSeen = true
				created = p
				return domain.RefreshToken{ID: p.ID}, nil
			},
		}
		users := &fakeUsers{findByIDFn: func(context.Context, string) (*domain.User, error) {
			return &domain.User{ID: "u1", Roles: []string{auth.RoleUser}}, nil
		}}
		s := NewService(users, tokens, &fakeHasher{}, 30)

		res, err := s.Refresh(context.Background(), "valid")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if res.Principal.Sub != "u1" {
			t.Fatalf("principal = %+v", res.Principal)
		}
		if !revokedBeforeCreate {
			t.Fatal("parent must be revoked BEFORE the child token is created")
		}
		if created.FamilyID != "f1" {
			t.Fatalf("new token family = %q, want f1 (same lineage)", created.FamilyID)
		}
		if created.ID == "" {
			t.Fatal("child token must be minted with a non-empty id")
		}
		// The parent's replaced_by_id must point at the exact child that was created.
		if revokedID != "rt1" || replacedBy == nil || *replacedBy != created.ID {
			t.Fatalf("old token not rotated correctly: revoked=%q replacedBy=%v childID=%q", revokedID, replacedBy, created.ID)
		}
	})

	t.Run("aborts without minting a second child when the parent was rotated concurrently", func(t *testing.T) {
		// TOCTOU race: FindByHash still reports the token live (a concurrent
		// refresh has also read it), but the conditional Revoke reports 0 rows
		// (revoked==false) because the other caller already won the rotation. The
		// loser must reject WITHOUT creating a child — otherwise two live children
		// share the parent and the single-active-token invariant breaks.
		createCalled := false
		tokens := &fakeTokens{
			findByHashFn: func(context.Context, string) (*domain.RefreshToken, error) { return liveToken(nil), nil },
			revokeFn:     func(context.Context, string, *string) (bool, error) { return false, nil },
			createFn: func(context.Context, CreateRefreshParams) (domain.RefreshToken, error) {
				createCalled = true
				return domain.RefreshToken{}, nil
			},
		}
		users := &fakeUsers{findByIDFn: func(context.Context, string) (*domain.User, error) {
			return &domain.User{ID: "u1", Roles: []string{auth.RoleUser}}, nil
		}}
		s := NewService(users, tokens, &fakeHasher{}, 30)

		_, err := s.Refresh(context.Background(), "raced")
		assertCode(t, err, apierror.CodeInvalidRefreshToken)
		if createCalled {
			t.Fatal("must not mint a child token after losing the rotation race")
		}
	})

	t.Run("rejects refresh when the user was soft-deleted", func(t *testing.T) {
		// Live, unexpired token but the owning user is gone (FindByID -> nil, nil).
		tokens := &fakeTokens{
			findByHashFn: func(context.Context, string) (*domain.RefreshToken, error) { return liveToken(nil), nil },
			revokeFn: func(context.Context, string, *string) (bool, error) {
				t.Fatal("must not rotate for a soft-deleted user")
				return false, nil
			},
		}
		users := &fakeUsers{findByIDFn: func(context.Context, string) (*domain.User, error) { return nil, nil }}
		s := NewService(users, tokens, &fakeHasher{}, 30)
		_, err := s.Refresh(context.Background(), "live-token-dead-user")
		assertCode(t, err, apierror.CodeInvalidRefreshToken)
	})
}

func TestLogout(t *testing.T) {
	t.Run("unknown token is a no-op (idempotent)", func(t *testing.T) {
		tokens := &fakeTokens{
			findByHashFn: func(context.Context, string) (*domain.RefreshToken, error) { return nil, nil },
			revokeFn: func(context.Context, string, *string) (bool, error) {
				t.Fatal("must not revoke an unknown token")
				return false, nil
			},
		}
		s := NewService(&fakeUsers{}, tokens, &fakeHasher{}, 30)
		if err := s.Logout(context.Background(), "u1", "unknown"); err != nil {
			t.Fatalf("logout of an unknown token should be a no-op, got %v", err)
		}
	})

	t.Run("revokes the caller's own live token", func(t *testing.T) {
		var revokedID string
		tokens := &fakeTokens{
			findByHashFn: func(context.Context, string) (*domain.RefreshToken, error) {
				return liveToken(func(rt *domain.RefreshToken) { rt.UserID = "u1" }), nil
			},
			revokeFn: func(_ context.Context, id string, _ *string) (bool, error) { revokedID = id; return true, nil },
		}
		s := NewService(&fakeUsers{}, tokens, &fakeHasher{}, 30)
		if err := s.Logout(context.Background(), "u1", "mine"); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if revokedID != "rt1" {
			t.Fatalf("expected the caller's own token revoked, got %q", revokedID)
		}
	})

	t.Run("IDOR: another user's token is NOT revoked (silent no-op)", func(t *testing.T) {
		// User A (caller "attacker") presents user B's ("victim") leaked refresh
		// token. It must behave like an unknown-token no-op — never revoke B's
		// session, never error (so it isn't an ownership oracle either).
		tokens := &fakeTokens{
			findByHashFn: func(context.Context, string) (*domain.RefreshToken, error) {
				return liveToken(func(rt *domain.RefreshToken) { rt.UserID = "victim" }), nil
			},
			revokeFn: func(context.Context, string, *string) (bool, error) {
				t.Fatal("must not revoke a token owned by another user")
				return false, nil
			},
		}
		s := NewService(&fakeUsers{}, tokens, &fakeHasher{}, 30)
		if err := s.Logout(context.Background(), "attacker", "victims-token"); err != nil {
			t.Fatalf("cross-user logout should be a silent no-op, got %v", err)
		}
	})
}
