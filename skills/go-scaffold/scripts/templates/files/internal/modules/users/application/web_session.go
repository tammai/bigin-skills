package application

import (
	"context"
	"time"

	"{{MODULE}}/internal/modules/users/domain"
	"{{MODULE}}/internal/shared/apperr"
	"{{MODULE}}/internal/shared/auth"
)

// IssuedSession is a freshly created browser session. Raw is the cookie value
// — the only moment it exists outside the browser, since storage keeps the
// hash — and ExpiresAt is the absolute expiry the cookie's Max-Age is set to.
type IssuedSession struct {
	Raw       string
	ExpiresAt time.Time
}

// errInvalidSession is the ONE answer for every way a session can fail to
// resolve. Unknown, idle-expired, absolute-expired, logged out, user deleted:
// telling them apart would tell an attacker holding a stolen cookie which of
// those happened.
func errInvalidSession() error {
	return apperr.Unauthorized("Invalid or expired session")
}

// CreateSession is the browser login. It runs the same credential check as
// Login, then stores a session row instead of minting tokens.
func (s *Service) CreateSession(ctx context.Context, email, password string) (*domain.User, IssuedSession, error) {
	user, err := s.authenticate(ctx, email, password)
	if err != nil {
		return nil, IssuedSession{}, err
	}

	raw, hash, err := auth.NewOpaqueToken()
	if err != nil {
		return nil, IssuedSession{}, apperr.Internal("Failed to generate session", err)
	}

	now := s.now()

	// An abandoned session is otherwise deleted only when its cookie comes
	// back — which, abandoned, it never does. Pruning the user's dead rows at
	// each login bounds them by how often that user logs in, with no
	// background job. Best effort: housekeeping must never fail a login.
	_ = s.sessions.DeleteExpiredForUser(ctx, user.ID, now)

	session := s.policy.Start(user.ID, hash, now)
	if err := s.sessions.Create(ctx, &session); err != nil {
		return nil, IssuedSession{}, err
	}
	return user, IssuedSession{Raw: raw, ExpiresAt: session.AbsoluteExpiresAt}, nil
}

// ResolveSession implements auth.SessionResolver: it runs on every
// cookie-authenticated request.
//
// The role is read from the users table each time rather than stored on the
// session. That costs a lookup, and buys a demotion or a deletion taking
// effect on the very next request instead of whenever the session happens to
// end — the property a JWT gives up and a server-side session exists to keep.
func (s *Service) ResolveSession(ctx context.Context, rawID string) (auth.Claims, error) {
	hash := auth.HashToken(rawID)
	session, err := s.sessions.ByHash(ctx, hash)
	if err != nil {
		if apperr.KindOf(err) == apperr.KindNotFound {
			return auth.Claims{}, errInvalidSession()
		}
		return auth.Claims{}, err
	}

	now := s.now()
	if session.Expired(now) {
		// Best effort: the request is refused either way, and a failed delete
		// only leaves a row that can never resolve again.
		_ = s.sessions.Delete(ctx, hash)
		return auth.Claims{}, errInvalidSession()
	}

	user, err := s.users.ByID(ctx, session.UserID)
	if err != nil {
		if apperr.KindOf(err) == apperr.KindNotFound {
			return auth.Claims{}, errInvalidSession()
		}
		return auth.Claims{}, err
	}

	if s.policy.Slide(session, now) {
		// Also best effort. Failing an otherwise valid request because the
		// idle bump could not be written would punish the user for a storage
		// hiccup; the cost of skipping it is at most one slide interval of
		// idle window.
		_ = s.sessions.UpdateActivity(ctx, session)
	}

	return auth.Claims{UserID: user.ID, Role: user.Role}, nil
}

// DeleteSession is the browser logout. It takes effect immediately — the next
// request with that cookie finds no row — which is what a server-side session
// buys over a stateless token.
//
// Deleting an unknown session is not an error, for the same reason Logout
// isn't: the caller wanted it gone and it is.
func (s *Service) DeleteSession(ctx context.Context, rawID string) error {
	return s.sessions.Delete(ctx, auth.HashToken(rawID))
}
