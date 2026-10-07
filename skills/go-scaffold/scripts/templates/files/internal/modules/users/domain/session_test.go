package domain

import (
	"testing"
	"time"
)

var testPolicy = SessionPolicy{IdleTTL: 72 * time.Hour, AbsoluteTTL: 30 * 24 * time.Hour}

func TestStartSetsBothExpiries(t *testing.T) {
	now := time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC)
	s := testPolicy.Start(7, "hash", now)

	if s.UserID != 7 || s.TokenHash != "hash" {
		t.Errorf("Start() = %+v, want user 7 with the given hash", s)
	}
	if !s.LastSeenAt.Equal(now) {
		t.Errorf("LastSeenAt = %v, want %v", s.LastSeenAt, now)
	}
	if want := now.Add(72 * time.Hour); !s.IdleExpiresAt.Equal(want) {
		t.Errorf("IdleExpiresAt = %v, want %v", s.IdleExpiresAt, want)
	}
	if want := now.Add(30 * 24 * time.Hour); !s.AbsoluteExpiresAt.Equal(want) {
		t.Errorf("AbsoluteExpiresAt = %v, want %v", s.AbsoluteExpiresAt, want)
	}
}

// An idle window longer than the absolute one would make the absolute cap a
// lie on paper; the idle expiry is clamped to it.
func TestIdleExpiryNeverPassesTheAbsoluteOne(t *testing.T) {
	now := time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC)
	p := SessionPolicy{IdleTTL: 48 * time.Hour, AbsoluteTTL: 24 * time.Hour}

	s := p.Start(1, "h", now)
	if s.IdleExpiresAt.After(s.AbsoluteExpiresAt) {
		t.Errorf("IdleExpiresAt %v is after AbsoluteExpiresAt %v", s.IdleExpiresAt, s.AbsoluteExpiresAt)
	}

	s = testPolicy.Start(1, "h", now)
	s.AbsoluteExpiresAt = now.Add(80 * time.Hour)
	testPolicy.Slide(&s, now.Add(70*time.Hour))
	if s.IdleExpiresAt.After(s.AbsoluteExpiresAt) {
		t.Errorf("after Slide, IdleExpiresAt %v is after AbsoluteExpiresAt %v", s.IdleExpiresAt, s.AbsoluteExpiresAt)
	}
}

func TestExpiredAtEitherBoundary(t *testing.T) {
	now := time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC)
	s := testPolicy.Start(1, "h", now)

	if s.Expired(now.Add(71 * time.Hour)) {
		t.Error("a session inside both windows reported expired")
	}
	if !s.Expired(s.IdleExpiresAt) {
		t.Error("a session at its idle expiry is still live — the boundary must be exclusive")
	}

	s.IdleExpiresAt = now.Add(100 * 24 * time.Hour)
	if !s.Expired(s.AbsoluteExpiresAt) {
		t.Error("a session past its absolute expiry is still live — activity must not extend it")
	}
}

// Sliding is a write on the hot path, so it happens at most once an hour per
// session rather than on every request.
func TestSlideOnlyAfterTheInterval(t *testing.T) {
	now := time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC)
	s := testPolicy.Start(1, "h", now)
	before := s

	if testPolicy.Slide(&s, now.Add(59*time.Minute)) {
		t.Error("Slide() reported a change inside the one-hour interval")
	}
	if s != before {
		t.Errorf("Slide() inside the interval mutated the session: %+v", s)
	}

	later := now.Add(61 * time.Minute)
	if !testPolicy.Slide(&s, later) {
		t.Fatal("Slide() did nothing after the interval had passed")
	}
	if !s.LastSeenAt.Equal(later) {
		t.Errorf("LastSeenAt = %v, want %v", s.LastSeenAt, later)
	}
	if want := later.Add(72 * time.Hour); !s.IdleExpiresAt.Equal(want) {
		t.Errorf("IdleExpiresAt = %v, want %v", s.IdleExpiresAt, want)
	}
	if !s.AbsoluteExpiresAt.Equal(before.AbsoluteExpiresAt) {
		t.Error("Slide() moved the absolute expiry — it must never move")
	}
}

// With SESSION_IDLE_HOURS=1 a fixed one-hour slide interval would never fire
// before the idle window closed: an active user would be logged out every hour.
// The interval shrinks to half the idle window, so activity always slides it in
// time.
func TestSlideIntervalFitsAShortIdleWindow(t *testing.T) {
	now := time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC)
	p := SessionPolicy{IdleTTL: time.Hour, AbsoluteTTL: 30 * 24 * time.Hour}
	s := p.Start(1, "h", now)

	if p.Slide(&s, now.Add(29*time.Minute)) {
		t.Error("Slide() fired before half the idle window had passed")
	}
	at := now.Add(31 * time.Minute)
	if !p.Slide(&s, at) {
		t.Fatal("Slide() did nothing past half a one-hour idle window — an active session would expire hourly")
	}
	if want := at.Add(time.Hour); !s.IdleExpiresAt.Equal(want) {
		t.Errorf("IdleExpiresAt = %v, want %v", s.IdleExpiresAt, want)
	}

	// Activity every 45 minutes keeps a one-hour-idle session alive for a day.
	s = p.Start(1, "h", now)
	for at := now.Add(45 * time.Minute); at.Before(now.Add(24 * time.Hour)); at = at.Add(45 * time.Minute) {
		if s.Expired(at) {
			t.Fatalf("active session expired at %v", at)
		}
		p.Slide(&s, at)
	}
}
