package application

import (
	"context"
	"testing"
	"time"

	"{{MODULE}}/internal/modules/users/domain"
	"{{MODULE}}/internal/shared/apperr"
	"{{MODULE}}/internal/shared/auth"
)

// The fakes below are why the ports in service.go point the way they do: every
// use-case test in this package runs with no database, no Docker, and no
// fixtures. They implement the same contract the real repositories do — a
// missing row is apperr.NotFound, never a nil result with a nil error.

type fakeUsers struct {
	byID   map[uint]*domain.User
	nextID uint
	// failNext makes the "storage is broken" branch reachable, which is the
	// branch that leaks driver text when a handler gets it wrong.
	failNext error
}

func newFakeUsers() *fakeUsers {
	return &fakeUsers{byID: map[uint]*domain.User{}, nextID: 1}
}

var _ UserRepository = (*fakeUsers)(nil)

func (f *fakeUsers) take() error {
	err := f.failNext
	f.failNext = nil
	return err
}

func (f *fakeUsers) Create(_ context.Context, u *domain.User) error {
	if err := f.take(); err != nil {
		return err
	}
	u.ID = f.nextID
	u.CreatedAt = time.Now()
	u.UpdatedAt = u.CreatedAt
	f.nextID++
	stored := *u
	f.byID[u.ID] = &stored
	return nil
}

func (f *fakeUsers) Update(_ context.Context, u *domain.User) error {
	if err := f.take(); err != nil {
		return err
	}
	if _, ok := f.byID[u.ID]; !ok {
		return apperr.NotFound("User not found")
	}
	stored := *u
	stored.UpdatedAt = time.Now()
	f.byID[u.ID] = &stored
	return nil
}

func (f *fakeUsers) Delete(_ context.Context, id uint) error {
	if err := f.take(); err != nil {
		return err
	}
	delete(f.byID, id)
	return nil
}

func (f *fakeUsers) ByID(_ context.Context, id uint) (*domain.User, error) {
	if err := f.take(); err != nil {
		return nil, err
	}
	u, ok := f.byID[id]
	if !ok {
		return nil, apperr.NotFound("User not found")
	}
	copied := *u
	return &copied, nil
}

func (f *fakeUsers) ByEmail(_ context.Context, email string) (*domain.User, error) {
	if err := f.take(); err != nil {
		return nil, err
	}
	for _, u := range f.byID {
		if u.Email == email {
			copied := *u
			return &copied, nil
		}
	}
	return nil, apperr.NotFound("User not found")
}

func (f *fakeUsers) Page(_ context.Context, offset, limit int) ([]domain.User, int64, error) {
	if err := f.take(); err != nil {
		return nil, 0, err
	}
	all := make([]domain.User, 0, len(f.byID))
	for id := uint(1); id < f.nextID; id++ {
		if u, ok := f.byID[id]; ok {
			all = append(all, *u)
		}
	}
	total := int64(len(all))
	if offset >= len(all) {
		return []domain.User{}, total, nil
	}
	end := min(offset+limit, len(all))
	return all[offset:end], total, nil
}

type fakeTokens struct {
	byHash map[string]*domain.RefreshToken
	nextID uint
}

func newFakeTokens() *fakeTokens {
	return &fakeTokens{byHash: map[string]*domain.RefreshToken{}, nextID: 1}
}

var _ RefreshTokenRepository = (*fakeTokens)(nil)

func (f *fakeTokens) Create(_ context.Context, t *domain.RefreshToken) error {
	t.ID = f.nextID
	t.CreatedAt = time.Now()
	f.nextID++
	stored := *t
	f.byHash[t.TokenHash] = &stored
	return nil
}

func (f *fakeTokens) ByHash(_ context.Context, hash string) (*domain.RefreshToken, error) {
	t, ok := f.byHash[hash]
	if !ok {
		return nil, apperr.NotFound("Refresh token not found")
	}
	copied := *t
	return &copied, nil
}

func (f *fakeTokens) Revoke(_ context.Context, hash string) error {
	if t, ok := f.byHash[hash]; ok {
		t.Revoked = true
	}
	return nil
}

type fakeSessions struct {
	byHash map[string]*domain.Session
	nextID uint
	// activityWrites counts UpdateActivity calls, so the slide tests can prove
	// a request inside the interval does not write at all.
	activityWrites int
	// failPrune makes DeleteExpiredForUser fail, to prove a cleanup failure
	// never blocks a login.
	failPrune error
}

func newFakeSessions() *fakeSessions {
	return &fakeSessions{byHash: map[string]*domain.Session{}, nextID: 1}
}

var _ SessionRepository = (*fakeSessions)(nil)

func (f *fakeSessions) Create(_ context.Context, s *domain.Session) error {
	s.ID = f.nextID
	f.nextID++
	stored := *s
	f.byHash[s.TokenHash] = &stored
	return nil
}

func (f *fakeSessions) ByHash(_ context.Context, hash string) (*domain.Session, error) {
	s, ok := f.byHash[hash]
	if !ok {
		return nil, apperr.NotFound("Session not found")
	}
	copied := *s
	return &copied, nil
}

func (f *fakeSessions) UpdateActivity(_ context.Context, s *domain.Session) error {
	f.activityWrites++
	for _, stored := range f.byHash {
		if stored.ID == s.ID {
			stored.LastSeenAt = s.LastSeenAt
			stored.IdleExpiresAt = s.IdleExpiresAt
		}
	}
	return nil
}

func (f *fakeSessions) DeleteExpiredForUser(_ context.Context, userID uint, now time.Time) error {
	if f.failPrune != nil {
		return f.failPrune
	}
	for hash, s := range f.byHash {
		if s.UserID == userID && s.Expired(now) {
			delete(f.byHash, hash)
		}
	}
	return nil
}

func (f *fakeSessions) Delete(_ context.Context, hash string) error {
	delete(f.byHash, hash)
	return nil
}

// testSessionPolicy matches the config defaults, so the expiry tests read in
// the same units an operator thinks in.
var testSessionPolicy = domain.SessionPolicy{IdleTTL: 72 * time.Hour, AbsoluteTTL: 30 * 24 * time.Hour}

// newTestService wires the fakes with a real TokenIssuer — tokens are pure
// computation, so there is nothing to gain from faking them and something to
// lose: the rotation tests below would stop proving that hashes actually match.
func newTestService(t *testing.T) (*Service, *fakeUsers, *fakeTokens) {
	t.Helper()
	svc, users, tokens, _ := newTestServiceWithSessions(t)
	return svc, users, tokens
}

func newTestServiceWithSessions(t *testing.T) (*Service, *fakeUsers, *fakeTokens, *fakeSessions) {
	t.Helper()
	users, tokens, sessions := newFakeUsers(), newFakeTokens(), newFakeSessions()
	issuer := auth.NewTokenIssuer([]byte("test-secret"), 15*time.Minute, 7*24*time.Hour)
	return NewService(users, tokens, sessions, issuer, testSessionPolicy), users, tokens, sessions
}

// testClock is a settable Service.now, so expiry is tested by moving time
// rather than by sleeping or by editing rows behind the service's back.
type testClock struct{ t time.Time }

func (c *testClock) now() time.Time          { return c.t }
func (c *testClock) advance(d time.Duration) { c.t = c.t.Add(d) }
func useClock(svc *Service, start time.Time) *testClock {
	c := &testClock{t: start}
	svc.now = c.now
	return c
}

// seedUser registers a user through the real SignUp path so the stored password
// hash is one CheckPassword will actually accept.
func seedUser(t *testing.T, svc *Service, email, password string) *domain.User {
	t.Helper()
	u, err := svc.SignUp(context.Background(), SignUpInput{
		Email:    email,
		Password: password,
		FullName: "Ada Lovelace",
	})
	if err != nil {
		t.Fatalf("seeding %s: %v", email, err)
	}
	return u
}
