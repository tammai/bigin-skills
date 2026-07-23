package application

import (
	"context"

	"{{MODULE}}/internal/posts/internal/domain"
	"{{MODULE}}/internal/shared/apierror"
	"{{MODULE}}/internal/shared/auth"
	"{{MODULE}}/internal/shared/pagination"
)

type CreatePostInput struct {
	Title string
	Body  string
}

func (s *Service) CreatePost(ctx context.Context, in CreatePostInput, actor auth.Principal) (domain.Post, error) {
	// RBAC checked in the use-case, not the route (ADR §4.2).
	if !auth.Can(actor.Roles, auth.PermPostsWrite) {
		return domain.Post{}, apierror.Unauthorized(apierror.CodeUnauthorized, "not allowed to create posts")
	}
	return s.posts.Create(ctx, CreatePostParams{Title: in.Title, Body: in.Body, AuthorID: actor.Sub})
}

// PostWithAuthor is a post joined with its author's public name for the list.
type PostWithAuthor struct {
	Post       domain.Post
	AuthorName *string
}

type ListPostsInput struct {
	Limit  *int
	Offset *int
}

type ListPostsResult struct {
	Data   []PostWithAuthor
	Limit  int
	Offset int
}

func (s *Service) ListPosts(ctx context.Context, in ListPostsInput, actor auth.Principal) (ListPostsResult, error) {
	// RBAC in the use-case, not the route: the caller needs posts:read (ADR §7).
	if !auth.Can(actor.Roles, auth.PermPostsRead) {
		return ListPostsResult{}, apierror.Unauthorized(apierror.CodeUnauthorized, "not allowed to list posts")
	}
	limit := pagination.ClampLimit(in.Limit)
	offset := pagination.ClampOffset(in.Offset)
	posts, err := s.posts.List(ctx, limit, offset)
	if err != nil {
		return ListPostsResult{}, err
	}

	// BATCH-GET: one call for the WHOLE page's authors (ADR §4.2) — the concrete
	// proof the module boundary avoids an N+1. A naive per-row GetUser would be
	// the obvious N+1; the public batch surface makes the batched form natural.
	ids := make([]string, 0, len(posts))
	for _, p := range posts {
		if p.AuthorID != nil {
			ids = append(ids, *p.AuthorID)
		}
	}
	names, err := s.users.GetManyByIDs(ctx, ids)
	if err != nil {
		return ListPostsResult{}, err
	}

	data := make([]PostWithAuthor, len(posts))
	for i, p := range posts {
		var name *string
		if p.AuthorID != nil {
			if n, ok := names[*p.AuthorID]; ok {
				v := n
				name = &v
			}
		}
		data[i] = PostWithAuthor{Post: p, AuthorName: name}
	}
	return ListPostsResult{Data: data, Limit: limit, Offset: offset}, nil
}

type UpdatePostInput struct {
	Title   *string
	Body    *string
	Version int
}

// UpdatePost applies optimistic concurrency (ADR §9.4): the caller's version must
// match the row's, or this returns 409 instead of silently overwriting someone
// else's edit.
func (s *Service) UpdatePost(ctx context.Context, id string, in UpdatePostInput, actor auth.Principal) (domain.Post, error) {
	current, err := s.posts.FindByID(ctx, id)
	if err != nil {
		return domain.Post{}, err
	}
	if current == nil {
		return domain.Post{}, apierror.NotFound(apierror.CodePostNotFound, "post not found")
	}
	// Ownership: only the author may edit. posts:write is granted to every 'user',
	// so it can't be the differentiator here the way it is for create.
	if current.AuthorID == nil || *current.AuthorID != actor.Sub {
		return domain.Post{}, apierror.Unauthorized(apierror.CodeUnauthorized, "not allowed to edit this post")
	}
	if current.Version != in.Version {
		return domain.Post{}, apierror.Conflict(apierror.CodePostVersionConflict, "post was modified since you last read it")
	}

	updated, err := s.posts.UpdateWithVersion(ctx, UpdatePostParams{
		ID:              id,
		ExpectedVersion: in.Version,
		Title:           in.Title,
		Body:            in.Body,
		UpdatedBy:       actor.Sub,
	})
	if err != nil {
		return domain.Post{}, err
	}
	if updated == nil {
		// Lost the race between the check above and the conditional UPDATE.
		return domain.Post{}, apierror.Conflict(apierror.CodePostVersionConflict, "post was modified since you last read it")
	}
	return *updated, nil
}

// AnonymizeAuthor is the posts module's public surface for the cross-module erase
// flow: users' erase use-case calls it synchronously to scrub an erased user's
// authorship. No RBAC here — it's an internal cross-module call, not a route.
func (s *Service) AnonymizeAuthor(ctx context.Context, userID string) error {
	return s.posts.AnonymizeAuthor(ctx, userID)
}
