package application

import (
	"context"

	"{{MODULE}}/internal/shared/apierror"
	"{{MODULE}}/internal/shared/auth"
	"{{MODULE}}/internal/users/internal/domain"
)

type CreateUserInput struct {
	Email    string
	Name     string
	Password string
	Roles    []string
	ActorID  *string
}

func (s *Service) CreateUser(ctx context.Context, in CreateUserInput) (domain.View, error) {
	existing, err := s.users.FindByEmail(ctx, in.Email)
	if err != nil {
		return domain.View{}, err
	}
	if existing != nil {
		return domain.View{}, apierror.Conflict(apierror.CodeUserEmailTaken, "email is already registered")
	}

	hash, err := s.hasher.Hash(in.Password)
	if err != nil {
		return domain.View{}, err
	}
	roles := in.Roles
	if len(roles) == 0 {
		roles = []string{auth.RoleUser}
	}
	u, err := s.users.Create(ctx, CreateUserParams{
		Email:        in.Email,
		Name:         in.Name,
		PasswordHash: hash,
		Roles:        roles,
		CreatedBy:    in.ActorID,
	})
	if err != nil {
		return domain.View{}, err
	}
	return domain.ToView(u), nil
}

// GetUser is the API single-user read. RBAC is checked HERE (in the use-case),
// not the route: the caller needs users:read (ADR §4.2, §7). Cross-module reads
// go through GetManyByIDs, which stays RBAC-free — it's an internal in-process
// surface (never a route), not a caller-facing read.
func (s *Service) GetUser(ctx context.Context, id string, actor auth.Principal) (*domain.View, error) {
	if !auth.Can(actor.Roles, auth.PermUsersRead) {
		return nil, apierror.Unauthorized(apierror.CodeUnauthorized, "not allowed to read users")
	}
	u, err := s.users.FindByID(ctx, id)
	if err != nil || u == nil {
		return nil, err
	}
	v := domain.ToView(*u)
	return &v, nil
}

// GetManyByIDs is the batch-get behind users' public read-composition surface
// (ADR §4.2). Dedupes ids and issues ONE query, returning id→name. posts'
// list use-case calls it once per page — never once per row (the N+1 the module
// boundary exists to prevent).
func (s *Service) GetManyByIDs(ctx context.Context, ids []string) (map[string]string, error) {
	seen := make(map[string]struct{}, len(ids))
	unique := make([]string, 0, len(ids))
	for _, id := range ids {
		if id == "" {
			continue
		}
		if _, dup := seen[id]; dup {
			continue
		}
		seen[id] = struct{}{}
		unique = append(unique, id)
	}
	out := make(map[string]string, len(unique))
	if len(unique) == 0 {
		return out, nil
	}
	users, err := s.users.FindManyByIDs(ctx, unique)
	if err != nil {
		return nil, err
	}
	for _, u := range users {
		out[u.ID] = domain.ToPublicView(u).Name
	}
	return out, nil
}

type ListUsersInput struct {
	Limit  *int
	Offset *int
}

type ListUsersResult struct {
	Data   []domain.View
	Limit  int
	Offset int
}

func (s *Service) ListUsers(ctx context.Context, in ListUsersInput, actor auth.Principal) (ListUsersResult, error) {
	// RBAC in the use-case, not the route: the caller needs users:read (ADR §7).
	if !auth.Can(actor.Roles, auth.PermUsersRead) {
		return ListUsersResult{}, apierror.Unauthorized(apierror.CodeUnauthorized, "not allowed to list users")
	}
	limit := clampLimit(in.Limit)
	offset := clampOffset(in.Offset)
	users, err := s.users.List(ctx, limit, offset)
	if err != nil {
		return ListUsersResult{}, err
	}
	data := make([]domain.View, len(users))
	for i, u := range users {
		data[i] = domain.ToView(u)
	}
	return ListUsersResult{Data: data, Limit: limit, Offset: offset}, nil
}

// EraseUser soft-deletes the user then synchronously anonymizes their posts via
// the cross-module public surface (ADR §8 erasure). RBAC is checked HERE (in the
// use-case), not the route: self-erase is allowed; erasing anyone else needs the
// users:erase permission.
func (s *Service) EraseUser(ctx context.Context, userID string, actor auth.Principal) error {
	if actor.Sub != userID && !auth.Can(actor.Roles, auth.PermUsersErase) {
		return apierror.Unauthorized(apierror.CodeUnauthorized, "not allowed to erase this user")
	}

	found, err := s.users.SoftDelete(ctx, userID, actor.Sub)
	if err != nil {
		return err
	}
	if !found {
		return apierror.NotFound(apierror.CodeUserNotFound, "user not found")
	}

	// Direct synchronous cross-module call through posts' public surface — NOT an
	// event bus. posts is reachable only via the injected interface; the users
	// module never imports posts' internals (boundary is compiler-enforced).
	return s.posts.AnonymizeAuthor(ctx, userID)
}
