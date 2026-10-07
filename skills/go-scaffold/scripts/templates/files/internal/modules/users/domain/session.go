package domain

import "time"

// SessionSlideInterval is the most LastSeenAt may go stale before activity
// moves the idle expiry. Sliding on every request would turn every
// authenticated read into a write; once an hour costs at most an hour of idle
// window, which is noise against a window measured in days. For a short idle
// window the policy uses half of it instead — see slideInterval.
const SessionSlideInterval = time.Hour

// Session is a browser login. Like a refresh token it is opaque — the cookie
// holds random bytes and the database only their SHA-256 hash — but unlike one
// it is never rotated or re-issued: the cookie set at login is the cookie used
// until logout or expiry, and all the state that changes lives in this row.
//
// Two clocks bound it. The idle expiry slides forward with activity, so an
// abandoned session dies quickly; the absolute expiry never moves, so a
// session that is used constantly — including by whoever stole it — still
// ends.
type Session struct {
	ID                uint
	UserID            uint
	TokenHash         string
	CreatedAt         time.Time
	LastSeenAt        time.Time
	IdleExpiresAt     time.Time
	AbsoluteExpiresAt time.Time
}

// Expired reports whether either clock has run out. Both boundaries are
// exclusive: at the expiry instant the session is already dead.
func (s *Session) Expired(now time.Time) bool {
	return !now.Before(s.IdleExpiresAt) || !now.Before(s.AbsoluteExpiresAt)
}

// SessionPolicy holds the two lifetimes. It is resolved once from config and
// passed in, so the rules below are pure functions of time a test can control.
type SessionPolicy struct {
	IdleTTL     time.Duration
	AbsoluteTTL time.Duration
}

// Start builds a new session for userID whose ID hashes to tokenHash.
func (p SessionPolicy) Start(userID uint, tokenHash string, now time.Time) Session {
	absolute := now.Add(p.AbsoluteTTL)
	return Session{
		UserID:            userID,
		TokenHash:         tokenHash,
		CreatedAt:         now,
		LastSeenAt:        now,
		IdleExpiresAt:     p.idleExpiry(now, absolute),
		AbsoluteExpiresAt: absolute,
	}
}

// Slide records activity at now, but only once the slide interval has passed
// since the last recorded activity. It reports whether it changed anything, so
// the caller writes to storage only when there is something to write.
func (p SessionPolicy) Slide(s *Session, now time.Time) bool {
	if now.Sub(s.LastSeenAt) <= p.slideInterval() {
		return false
	}
	s.LastSeenAt = now
	s.IdleExpiresAt = p.idleExpiry(now, s.AbsoluteExpiresAt)
	return true
}

// slideInterval is SessionSlideInterval or half the idle window, whichever is
// shorter. With a fixed hour and SESSION_IDLE_HOURS=1 the idle window would
// close before activity was ever allowed to slide it, logging an active user
// out every hour; half the window guarantees a request inside it slides it.
func (p SessionPolicy) slideInterval() time.Duration {
	return min(SessionSlideInterval, p.IdleTTL/2)
}

// idleExpiry is clamped to the absolute expiry. An idle window reaching past
// it would make no difference to Expired, but it would make the row claim a
// lifetime the session does not have.
func (p SessionPolicy) idleExpiry(now, absolute time.Time) time.Time {
	idle := now.Add(p.IdleTTL)
	if idle.After(absolute) {
		return absolute
	}
	return idle
}
