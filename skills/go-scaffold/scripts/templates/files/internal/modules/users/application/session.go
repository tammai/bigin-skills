package application

import (
	"context"
	"time"

	"{{MODULE}}/internal/modules/users/domain"
	"{{MODULE}}/internal/shared/apperr"
	"{{MODULE}}/internal/shared/auth"
	"{{MODULE}}/internal/shared/validate"
)

// Login verifies credentials and issues a token pair.
//
// A missing user and a wrong password return the SAME error. Distinguishing
// them turns the login endpoint into an account-enumeration oracle, which is
// why the lookup failure is not passed through as a 404.
func (s *Service) Login(ctx context.Context, email, password string) (*domain.User, Tokens, error) {
	user, err := s.users.ByEmail(ctx, validate.NormalizeEmail(email))
	if err != nil {
		if apperr.KindOf(err) == apperr.KindNotFound {
			return nil, Tokens{}, apperr.Unauthorized("Invalid email or password")
		}
		return nil, Tokens{}, err
	}

	if err := auth.CheckPassword(user.PasswordHash, password); err != nil {
		return nil, Tokens{}, apperr.Unauthorized("Invalid email or password")
	}

	tokens, err := s.issue(ctx, user)
	if err != nil {
		return nil, Tokens{}, err
	}
	return user, tokens, nil
}

// Refresh exchanges a refresh token for a new pair, ROTATING it: the presented
// token is revoked before the new one is issued.
//
// Rotation is what makes theft detectable. A stolen token works once; the
// second use — by whichever party is slower — finds it already revoked and gets
// a 401 instead of a silent, indefinite session.
func (s *Service) Refresh(ctx context.Context, rawToken string) (Tokens, error) {
	stored, err := s.tokens.ByHash(ctx, auth.HashToken(rawToken))
	if err != nil {
		if apperr.KindOf(err) == apperr.KindNotFound {
			return Tokens{}, apperr.Unauthorized("Invalid refresh token")
		}
		return Tokens{}, err
	}
	if !stored.Usable(time.Now()) {
		return Tokens{}, apperr.Unauthorized("Refresh token expired or revoked")
	}

	user, err := s.users.ByID(ctx, stored.UserID)
	if err != nil {
		if apperr.KindOf(err) == apperr.KindNotFound {
			return Tokens{}, apperr.Unauthorized("Invalid refresh token")
		}
		return Tokens{}, err
	}

	// Revoke BEFORE issuing. If the issue step fails afterwards the client
	// simply logs in again; revoking last would leave a window where a replay
	// still succeeds.
	if err := s.tokens.Revoke(ctx, stored.TokenHash); err != nil {
		return Tokens{}, err
	}
	return s.issue(ctx, user)
}

// Logout revokes the refresh token. Access tokens are stateless and stay valid
// until they expire — that is the trade JWTs make, and the reason the access
// lifetime is short.
//
// Revoking an unknown token is not an error: the caller wanted the token dead
// and it is, and saying "no such token" would confirm which tokens exist.
func (s *Service) Logout(ctx context.Context, rawToken string) error {
	return s.tokens.Revoke(ctx, auth.HashToken(rawToken))
}

func (s *Service) issue(ctx context.Context, user *domain.User) (Tokens, error) {
	access, err := s.issuer.Access(user.ID, user.Role)
	if err != nil {
		return Tokens{}, apperr.Internal("Failed to generate access token", err)
	}

	raw, hash, err := s.issuer.NewRefreshToken()
	if err != nil {
		return Tokens{}, apperr.Internal("Failed to generate refresh token", err)
	}

	record := &domain.RefreshToken{
		UserID:    user.ID,
		TokenHash: hash,
		ExpiresAt: time.Now().Add(s.issuer.RefreshTTL()),
	}
	if err := s.tokens.Create(ctx, record); err != nil {
		return Tokens{}, err
	}

	return Tokens{Access: access, Refresh: raw}, nil
}
