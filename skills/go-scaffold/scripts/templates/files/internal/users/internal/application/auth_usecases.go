package application

import (
	"context"
	"time"

	"{{MODULE}}/internal/shared/apierror"
	"{{MODULE}}/internal/shared/auth"
	"{{MODULE}}/internal/shared/pgconv"
)

// Login verifies credentials and issues a fresh refresh-token family. The
// access JWT is signed in the api layer from the returned principal.
func (s *Service) Login(ctx context.Context, email, password string) (LoginResult, error) {
	u, err := s.users.FindByEmail(ctx, email)
	if err != nil {
		return LoginResult{}, err
	}
	// The generic message avoids user enumeration whether or not the user exists.
	if u == nil {
		// Pay the argon2id verification cost even with no matching account, so
		// login latency can't distinguish "no such user" from "wrong password"
		// (both return the identical generic error). See auth.DummyPasswordHash.
		_, _ = s.hasher.Verify(auth.DummyPasswordHash, password)
		return LoginResult{}, apierror.Unauthenticated(apierror.CodeInvalidCredentials, "invalid credentials")
	}
	ok, err := s.hasher.Verify(u.PasswordHash, password)
	if err != nil {
		return LoginResult{}, err
	}
	if !ok {
		return LoginResult{}, apierror.Unauthenticated(apierror.CodeInvalidCredentials, "invalid credentials")
	}

	raw, err := auth.GenerateRefreshToken()
	if err != nil {
		return LoginResult{}, err
	}
	if _, err := s.tokens.Create(ctx, CreateRefreshParams{
		ID:        pgconv.NewUUIDv7(),
		UserID:    u.ID,
		TokenHash: auth.HashRefreshToken(raw),
		FamilyID:  pgconv.NewUUIDv7(),
		ExpiresAt: time.Now().Add(s.refreshTTL),
	}); err != nil {
		return LoginResult{}, err
	}
	return LoginResult{Principal: auth.Principal{Sub: u.ID, Roles: u.Roles}, RefreshToken: raw}, nil
}

// Refresh is rotating refresh with reuse detection: presenting an
// already-revoked token means the lineage is compromised — revoke the whole
// family and reject (ADR §7).
func (s *Service) Refresh(ctx context.Context, rawToken string) (LoginResult, error) {
	existing, err := s.tokens.FindByHash(ctx, auth.HashRefreshToken(rawToken))
	if err != nil {
		return LoginResult{}, err
	}
	if existing == nil {
		return LoginResult{}, apierror.Unauthenticated(apierror.CodeInvalidRefreshToken, "invalid refresh token")
	}
	if existing.Revoked() {
		if err := s.tokens.RevokeFamily(ctx, existing.FamilyID); err != nil {
			return LoginResult{}, err
		}
		return LoginResult{}, apierror.Unauthenticated(apierror.CodeInvalidRefreshToken, "refresh token reuse detected")
	}
	if existing.Expired() {
		return LoginResult{}, apierror.Unauthenticated(apierror.CodeInvalidRefreshToken, "refresh token expired")
	}

	u, err := s.users.FindByID(ctx, existing.UserID)
	if err != nil {
		return LoginResult{}, err
	}
	if u == nil {
		return LoginResult{}, apierror.Unauthenticated(apierror.CodeInvalidRefreshToken, "invalid refresh token")
	}

	raw, err := auth.GenerateRefreshToken()
	if err != nil {
		return LoginResult{}, err
	}
	childID := pgconv.NewUUIDv7()

	// Revoke the parent FIRST, conditionally on it still being live (the repo's
	// UPDATE ... WHERE revoked_at IS NULL). That single conditional write is the
	// serialization point for concurrent refreshes of the same token: only one
	// caller flips revoked_at from NULL and gets revoked==true. A racing refresh
	// that read the token as live before this ran gets revoked==false here and
	// MUST abort WITHOUT minting a child — otherwise two live children would
	// share one parent and the single-active-token / reuse-detection invariant
	// breaks (finding: TOCTOU race). Revoking before creating also means a failure
	// between the two steps fails safe (session dead) rather than leaving two
	// usable tokens. replaced_by_id points at childID, which the child below then
	// takes as its own primary key.
	revoked, err := s.tokens.Revoke(ctx, existing.ID, &childID)
	if err != nil {
		return LoginResult{}, err
	}
	if !revoked {
		return LoginResult{}, apierror.Unauthenticated(apierror.CodeInvalidRefreshToken, "invalid refresh token")
	}

	if _, err := s.tokens.Create(ctx, CreateRefreshParams{
		ID:        childID,
		UserID:    u.ID,
		TokenHash: auth.HashRefreshToken(raw),
		FamilyID:  existing.FamilyID, // same lineage
		ExpiresAt: time.Now().Add(s.refreshTTL),
	}); err != nil {
		return LoginResult{}, err
	}
	return LoginResult{Principal: auth.Principal{Sub: u.ID, Roles: u.Roles}, RefreshToken: raw}, nil
}

// Logout revokes the presented refresh token, but ONLY when it belongs to the
// calling principal (callerID). A token that is unknown, already revoked, or
// owned by another user is treated identically — a silent no-op — so Logout can
// neither revoke someone else's session by presenting their leaked token
// (finding: IDOR) nor become an ownership/existence oracle. Idempotent: logout
// never errors on a token it won't act on.
func (s *Service) Logout(ctx context.Context, callerID, rawToken string) error {
	existing, err := s.tokens.FindByHash(ctx, auth.HashRefreshToken(rawToken))
	if err != nil {
		return err
	}
	if existing != nil && existing.UserID == callerID && !existing.Revoked() {
		if _, err := s.tokens.Revoke(ctx, existing.ID, nil); err != nil {
			return err
		}
	}
	return nil
}
