package application

import (
	"context"

	"{{MODULE}}/internal/modules/users/domain"
)

// Profile returns the caller's own record. The ID comes from verified token
// claims, never from the request body or a query parameter — an endpoint that
// takes the user ID from the client is an authorization bug with a REST shape.
func (s *Service) Profile(ctx context.Context, userID uint) (*domain.User, error) {
	return s.users.ByID(ctx, userID)
}

// UpdateProfile changes only what a user may change about themselves. fullName
// is a pointer because the contract's field is optional: nil means "not
// supplied", which is different from an empty string.
//
// Email, role, and password are deliberately absent. Each needs its own flow
// (re-verification, an admin check, the old password), and folding them into a
// generic profile update is how those checks get skipped.
func (s *Service) UpdateProfile(ctx context.Context, userID uint, fullName *string) (*domain.User, error) {
	user, err := s.users.ByID(ctx, userID)
	if err != nil {
		return nil, err
	}

	if fullName != nil {
		if err := user.Rename(*fullName); err != nil {
			return nil, err
		}
	}

	if err := s.users.Update(ctx, user); err != nil {
		return nil, err
	}
	return user, nil
}
