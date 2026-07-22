package application

import (
	"context"
	"testing"
	"time"

	"{{MODULE}}/internal/posts/internal/domain"
	"{{MODULE}}/internal/shared/apierror"
	"{{MODULE}}/internal/shared/auth"
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

func strptr(s string) *string { return &s }

func post(overrides func(*domain.Post)) domain.Post {
	author := "u1"
	p := domain.Post{ID: "p1", AuthorID: &author, Title: "t", Body: "b", Version: 1, CreatedAt: time.Unix(0, 0)}
	if overrides != nil {
		overrides(&p)
	}
	return p
}

func TestCreatePost(t *testing.T) {
	t.Run("denies a caller lacking posts:write", func(t *testing.T) {
		s := NewService(&fakePosts{createFn: func(context.Context, CreatePostParams) (domain.Post, error) {
			t.Fatal("must not create when unauthorized")
			return domain.Post{}, nil
		}}, &fakeUserDir{})
		_, err := s.CreatePost(context.Background(), CreatePostInput{Title: "x", Body: "y"}, auth.Principal{Sub: "u1", Roles: []string{"guest"}})
		assertCode(t, err, apierror.CodeUnauthorized)
	})

	t.Run("creates with the actor as author", func(t *testing.T) {
		var gotAuthor string
		s := NewService(&fakePosts{createFn: func(_ context.Context, p CreatePostParams) (domain.Post, error) {
			gotAuthor = p.AuthorID
			return post(nil), nil
		}}, &fakeUserDir{})
		_, err := s.CreatePost(context.Background(), CreatePostInput{Title: "x", Body: "y"}, auth.Principal{Sub: "u1", Roles: []string{auth.RoleUser}})
		if err != nil {
			t.Fatal(err)
		}
		if gotAuthor != "u1" {
			t.Fatalf("author = %q, want u1", gotAuthor)
		}
	})
}

func TestListPostsBatchesAuthors(t *testing.T) {
	reader := auth.Principal{Sub: "u1", Roles: []string{auth.RoleUser}}

	t.Run("denies a caller lacking posts:read", func(t *testing.T) {
		posts := &fakePosts{listFn: func(context.Context, int, int) ([]domain.Post, error) {
			t.Fatal("must not list when unauthorized")
			return nil, nil
		}}
		s := NewService(posts, &fakeUserDir{})
		_, err := s.ListPosts(context.Background(), ListPostsInput{}, auth.Principal{Sub: "u1", Roles: []string{"guest"}})
		assertCode(t, err, apierror.CodeUnauthorized)
	})

	t.Run("one GetManyByIDs call for the whole page (no N+1)", func(t *testing.T) {
		posts := &fakePosts{listFn: func(context.Context, int, int) ([]domain.Post, error) {
			return []domain.Post{
				post(func(p *domain.Post) { p.ID = "p1"; p.AuthorID = strptr("u1") }),
				post(func(p *domain.Post) { p.ID = "p2"; p.AuthorID = strptr("u2") }),
			}, nil
		}}
		var gotIDs []string
		users := &fakeUserDir{fn: func(_ context.Context, ids []string) (map[string]string, error) {
			gotIDs = ids
			return map[string]string{"u1": "Ada", "u2": "Bo"}, nil
		}}
		s := NewService(posts, users)

		res, err := s.ListPosts(context.Background(), ListPostsInput{}, reader)
		if err != nil {
			t.Fatal(err)
		}
		if users.calls != 1 {
			t.Fatalf("expected exactly 1 batch call, got %d", users.calls)
		}
		if len(gotIDs) != 2 {
			t.Fatalf("expected 2 author ids batched, got %v", gotIDs)
		}
		if res.Data[0].AuthorName == nil || *res.Data[0].AuthorName != "Ada" {
			t.Fatalf("author name[0] = %v, want Ada", res.Data[0].AuthorName)
		}
	})

	t.Run("null author_name for an anonymized post", func(t *testing.T) {
		posts := &fakePosts{listFn: func(context.Context, int, int) ([]domain.Post, error) {
			return []domain.Post{post(func(p *domain.Post) { p.AuthorID = nil })}, nil
		}}
		var gotIDs []string
		users := &fakeUserDir{fn: func(_ context.Context, ids []string) (map[string]string, error) {
			gotIDs = ids
			return map[string]string{}, nil
		}}
		s := NewService(posts, users)

		res, err := s.ListPosts(context.Background(), ListPostsInput{}, reader)
		if err != nil {
			t.Fatal(err)
		}
		if len(gotIDs) != 0 {
			t.Fatalf("expected no author ids, got %v", gotIDs)
		}
		if res.Data[0].AuthorName != nil {
			t.Fatalf("author name = %v, want nil", res.Data[0].AuthorName)
		}
	})
}

func TestUpdatePost(t *testing.T) {
	actor := auth.Principal{Sub: "u1", Roles: []string{auth.RoleUser}}

	t.Run("not found for a missing post", func(t *testing.T) {
		s := NewService(&fakePosts{findByIDFn: func(context.Context, string) (*domain.Post, error) { return nil, nil }}, &fakeUserDir{})
		_, err := s.UpdatePost(context.Background(), "missing", UpdatePostInput{Version: 1}, actor)
		assertCode(t, err, apierror.CodePostNotFound)
	})

	t.Run("rejects a non-author editor", func(t *testing.T) {
		s := NewService(&fakePosts{
			findByIDFn: func(context.Context, string) (*domain.Post, error) { p := post(nil); return &p, nil },
			updateFn: func(context.Context, UpdatePostParams) (*domain.Post, error) {
				t.Fatal("must not update when not the author")
				return nil, nil
			},
		}, &fakeUserDir{})
		_, err := s.UpdatePost(context.Background(), "p1", UpdatePostInput{Version: 1}, auth.Principal{Sub: "someone-else", Roles: []string{auth.RoleUser}})
		assertCode(t, err, apierror.CodeUnauthorized)
	})

	t.Run("stale version conflicts before attempting the update", func(t *testing.T) {
		s := NewService(&fakePosts{
			findByIDFn: func(context.Context, string) (*domain.Post, error) { p := post(func(p *domain.Post) { p.Version = 3 }); return &p, nil },
			updateFn: func(context.Context, UpdatePostParams) (*domain.Post, error) {
				t.Fatal("must not update on a stale version")
				return nil, nil
			},
		}, &fakeUserDir{})
		_, err := s.UpdatePost(context.Background(), "p1", UpdatePostInput{Version: 1}, actor)
		assertCode(t, err, apierror.CodePostVersionConflict)
	})

	t.Run("conflict when the conditional UPDATE loses a race", func(t *testing.T) {
		s := NewService(&fakePosts{
			findByIDFn: func(context.Context, string) (*domain.Post, error) { p := post(nil); return &p, nil },
			updateFn:   func(context.Context, UpdatePostParams) (*domain.Post, error) { return nil, nil },
		}, &fakeUserDir{})
		_, err := s.UpdatePost(context.Background(), "p1", UpdatePostInput{Version: 1}, actor)
		assertCode(t, err, apierror.CodePostVersionConflict)
	})

	t.Run("updates when author matches and version is current", func(t *testing.T) {
		var gotParams UpdatePostParams
		s := NewService(&fakePosts{
			findByIDFn: func(context.Context, string) (*domain.Post, error) { p := post(nil); return &p, nil },
			updateFn: func(_ context.Context, p UpdatePostParams) (*domain.Post, error) {
				gotParams = p
				out := post(func(pp *domain.Post) { pp.Version = 2; pp.Title = "new" })
				return &out, nil
			},
		}, &fakeUserDir{})
		res, err := s.UpdatePost(context.Background(), "p1", UpdatePostInput{Title: strptr("new"), Version: 1}, actor)
		if err != nil {
			t.Fatal(err)
		}
		if res.Version != 2 {
			t.Fatalf("version = %d, want 2", res.Version)
		}
		if gotParams.ExpectedVersion != 1 || gotParams.UpdatedBy != "u1" {
			t.Fatalf("update params = %+v", gotParams)
		}
	})
}
