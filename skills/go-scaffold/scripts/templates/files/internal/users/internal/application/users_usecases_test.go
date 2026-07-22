package application

import (
	"context"
	"errors"
	"testing"
	"time"

	"{{MODULE}}/internal/shared/apierror"
	"{{MODULE}}/internal/shared/auth"
	"{{MODULE}}/internal/users/internal/domain"
)

func assertCode(t *testing.T, err error, wantCode string) {
	t.Helper()
	ae, ok := apierror.As(err)
	if !ok {
		t.Fatalf("expected *apierror.AppError, got %v", err)
	}
	if ae.Code != wantCode {
		t.Fatalf("code = %q, want %q", ae.Code, wantCode)
	}
}

func TestCreateUser(t *testing.T) {
	t.Run("conflict when the email is already registered", func(t *testing.T) {
		users := &fakeUsers{
			findByEmailFn: func(context.Context, string) (*domain.User, error) {
				return &domain.User{ID: "u1", Email: "a@example.com"}, nil
			},
			createFn: func(context.Context, CreateUserParams) (domain.User, error) {
				t.Fatal("create must not be called on conflict")
				return domain.User{}, nil
			},
		}
		s := NewService(users, &fakeTokens{}, &fakeHasher{}, 30)
		_, err := s.CreateUser(context.Background(), CreateUserInput{Email: "a@example.com", Name: "Ada", Password: "password123"})
		assertCode(t, err, apierror.CodeUserEmailTaken)
	})

	t.Run("hashes the password and defaults the role", func(t *testing.T) {
		var gotParams CreateUserParams
		users := &fakeUsers{
			findByEmailFn: func(context.Context, string) (*domain.User, error) { return nil, nil },
			createFn: func(_ context.Context, p CreateUserParams) (domain.User, error) {
				gotParams = p
				return domain.User{ID: "u1", Email: p.Email, Name: p.Name, CreatedAt: time.Unix(0, 0)}, nil
			},
		}
		hasher := &fakeHasher{hashFn: func(string) (string, error) { return "hashed", nil }}
		s := NewService(users, &fakeTokens{}, hasher, 30)

		view, err := s.CreateUser(context.Background(), CreateUserInput{Email: "a@example.com", Name: "Ada", Password: "password123"})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if gotParams.PasswordHash != "hashed" {
			t.Fatalf("password hash = %q, want hashed", gotParams.PasswordHash)
		}
		if len(gotParams.Roles) != 1 || gotParams.Roles[0] != auth.RoleUser {
			t.Fatalf("roles = %v, want [user]", gotParams.Roles)
		}
		if view.ID != "u1" {
			t.Fatalf("view id = %q, want u1", view.ID)
		}
	})
}

func TestGetManyByIDs(t *testing.T) {
	t.Run("dedupes ids into one query and maps id to name", func(t *testing.T) {
		var gotIDs []string
		users := &fakeUsers{
			findManyByIDsFn: func(_ context.Context, ids []string) ([]domain.User, error) {
				gotIDs = ids
				return []domain.User{{ID: "u1", Name: "Ada"}, {ID: "u2", Name: "Bo"}}, nil
			},
		}
		s := NewService(users, &fakeTokens{}, &fakeHasher{}, 30)

		got, err := s.GetManyByIDs(context.Background(), []string{"u1", "u2", "u1", ""})
		if err != nil {
			t.Fatal(err)
		}
		if len(gotIDs) != 2 {
			t.Fatalf("expected 2 deduped non-empty ids, got %v", gotIDs)
		}
		if got["u1"] != "Ada" || got["u2"] != "Bo" {
			t.Fatalf("name map = %v", got)
		}
	})

	t.Run("no query for an empty id set", func(t *testing.T) {
		users := &fakeUsers{findManyByIDsFn: func(context.Context, []string) ([]domain.User, error) {
			t.Fatal("must not query with no ids")
			return nil, nil
		}}
		s := NewService(users, &fakeTokens{}, &fakeHasher{}, 30)
		got, err := s.GetManyByIDs(context.Background(), []string{"", ""})
		if err != nil || len(got) != 0 {
			t.Fatalf("expected empty map, got %v err %v", got, err)
		}
	})
}

func TestEraseUser(t *testing.T) {
	t.Run("rejects erasing another user without the permission", func(t *testing.T) {
		users := &fakeUsers{softDeleteFn: func(context.Context, string, string) (bool, error) {
			t.Fatal("must not soft-delete when unauthorized")
			return false, nil
		}}
		anon := &fakeAnonymizer{}
		s := NewService(users, &fakeTokens{}, &fakeHasher{}, 30)
		s.UsePostAnonymizer(anon)
		err := s.EraseUser(context.Background(), "someone-else", auth.Principal{Sub: "u1", Roles: []string{auth.RoleUser}})
		assertCode(t, err, apierror.CodeUnauthorized)
	})

	t.Run("not found when no live row matched", func(t *testing.T) {
		users := &fakeUsers{softDeleteFn: func(context.Context, string, string) (bool, error) { return false, nil }}
		s := NewService(users, &fakeTokens{}, &fakeHasher{}, 30)
		s.UsePostAnonymizer(&fakeAnonymizer{})
		err := s.EraseUser(context.Background(), "u1", auth.Principal{Sub: "u1", Roles: []string{auth.RoleUser}})
		assertCode(t, err, apierror.CodeUserNotFound)
	})

	t.Run("self-erase soft-deletes then anonymizes the user's posts", func(t *testing.T) {
		users := &fakeUsers{softDeleteFn: func(context.Context, string, string) (bool, error) { return true, nil }}
		anon := &fakeAnonymizer{}
		s := NewService(users, &fakeTokens{}, &fakeHasher{}, 30)
		s.UsePostAnonymizer(anon)
		if err := s.EraseUser(context.Background(), "u1", auth.Principal{Sub: "u1", Roles: []string{auth.RoleUser}}); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if anon.calledWith != "u1" {
			t.Fatalf("anonymize called with %q, want u1", anon.calledWith)
		}
	})

	t.Run("admin may erase another user", func(t *testing.T) {
		users := &fakeUsers{softDeleteFn: func(context.Context, string, string) (bool, error) { return true, nil }}
		anon := &fakeAnonymizer{}
		s := NewService(users, &fakeTokens{}, &fakeHasher{}, 30)
		s.UsePostAnonymizer(anon)
		if err := s.EraseUser(context.Background(), "victim", auth.Principal{Sub: "admin", Roles: []string{auth.RoleAdmin}}); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if anon.calledWith != "victim" {
			t.Fatalf("anonymize called with %q, want victim", anon.calledWith)
		}
	})

	t.Run("surfaces an anonymize failure", func(t *testing.T) {
		users := &fakeUsers{softDeleteFn: func(context.Context, string, string) (bool, error) { return true, nil }}
		anon := &fakeAnonymizer{err: errors.New("posts down")}
		s := NewService(users, &fakeTokens{}, &fakeHasher{}, 30)
		s.UsePostAnonymizer(anon)
		if err := s.EraseUser(context.Background(), "u1", auth.Principal{Sub: "u1", Roles: []string{auth.RoleUser}}); err == nil {
			t.Fatal("expected the anonymize error to propagate")
		}
	})
}

func TestListUsersClampsLimit(t *testing.T) {
	var gotLimit int
	users := &fakeUsers{listFn: func(_ context.Context, limit, _ int) ([]domain.User, error) {
		gotLimit = limit
		return nil, nil
	}}
	s := NewService(users, &fakeTokens{}, &fakeHasher{}, 30)
	over := 1000
	reader := auth.Principal{Sub: "u1", Roles: []string{auth.RoleUser}}
	res, err := s.ListUsers(context.Background(), ListUsersInput{Limit: &over}, reader)
	if err != nil {
		t.Fatal(err)
	}
	if gotLimit != maxLimit || res.Limit != maxLimit {
		t.Fatalf("limit not clamped: repo=%d result=%d want %d", gotLimit, res.Limit, maxLimit)
	}
}

func TestListUsersRBAC(t *testing.T) {
	t.Run("denies a caller lacking users:read", func(t *testing.T) {
		users := &fakeUsers{listFn: func(context.Context, int, int) ([]domain.User, error) {
			t.Fatal("must not query the store when unauthorized")
			return nil, nil
		}}
		s := NewService(users, &fakeTokens{}, &fakeHasher{}, 30)
		_, err := s.ListUsers(context.Background(), ListUsersInput{}, auth.Principal{Sub: "u1", Roles: []string{"guest"}})
		assertCode(t, err, apierror.CodeUnauthorized)
	})
}

func TestGetUser(t *testing.T) {
	t.Run("denies a caller lacking users:read", func(t *testing.T) {
		users := &fakeUsers{findByIDFn: func(context.Context, string) (*domain.User, error) {
			t.Fatal("must not query the store when unauthorized")
			return nil, nil
		}}
		s := NewService(users, &fakeTokens{}, &fakeHasher{}, 30)
		_, err := s.GetUser(context.Background(), "u1", auth.Principal{Sub: "u1", Roles: []string{"guest"}})
		assertCode(t, err, apierror.CodeUnauthorized)
	})

	t.Run("returns the view for an authorized reader", func(t *testing.T) {
		users := &fakeUsers{findByIDFn: func(context.Context, string) (*domain.User, error) {
			return &domain.User{ID: "u1", Email: "a@example.com", Name: "Ada"}, nil
		}}
		s := NewService(users, &fakeTokens{}, &fakeHasher{}, 30)
		view, err := s.GetUser(context.Background(), "u1", auth.Principal{Sub: "u2", Roles: []string{auth.RoleUser}})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if view == nil || view.ID != "u1" {
			t.Fatalf("view = %+v, want id u1", view)
		}
	})
}
