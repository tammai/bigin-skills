package application

import (
	"context"

	"{{MODULE}}/internal/modules/users/domain"
	"{{MODULE}}/internal/shared/apperr"
	"{{MODULE}}/internal/shared/auth"
)

// UserPage is one page of results plus what the caller needs to ask for the
// next one.
type UserPage struct {
	Users []domain.User
	Page  int
	Limit int
	Total int
}

const (
	defaultPageLimit = 20
	maxPageLimit     = 100
)

// ListUsers clamps paging here rather than trusting the query string. The
// contract declares the bounds, but the generated router does not enforce
// schema minimums on query parameters — an unclamped limit=1000000 is a trivial
// way to make the database do all the work.
func (s *Service) ListUsers(ctx context.Context, page, limit int) (UserPage, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > maxPageLimit {
		limit = defaultPageLimit
	}

	users, total, err := s.users.Page(ctx, (page-1)*limit, limit)
	if err != nil {
		return UserPage{}, err
	}
	return UserPage{Users: users, Page: page, Limit: limit, Total: int(total)}, nil
}

// ChangeRole is an admin operation, with one guard that is not about
// permissions: an admin may not demote themselves.
//
// The requester is already an admin — the middleware saw to that — so this is
// not an authorization check but a foot-gun check. In a system whose first
// admin is created by hand, self-demotion can leave zero admins and no way back
// in through the API.
func (s *Service) ChangeRole(ctx context.Context, requesterID, targetID uint, role string) (*domain.User, error) {
	user, err := s.users.ByID(ctx, targetID)
	if err != nil {
		return nil, err
	}

	if requesterID == targetID && role != auth.RoleAdmin {
		return nil, apperr.Invalid("Cannot demote your own account")
	}

	if err := user.ChangeRole(role); err != nil {
		return nil, err
	}
	if err := s.users.Update(ctx, user); err != nil {
		return nil, err
	}
	return user, nil
}

// DeleteUser refuses self-deletion for the same reason ChangeRole refuses
// self-demotion, and checks existence first so deleting a missing user is a 404
// rather than a cheerful 200.
func (s *Service) DeleteUser(ctx context.Context, requesterID, targetID uint) error {
	if requesterID == targetID {
		return apperr.Invalid("Cannot delete your own account")
	}
	if _, err := s.users.ByID(ctx, targetID); err != nil {
		return err
	}
	return s.users.Delete(ctx, targetID)
}
