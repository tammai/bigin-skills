package application

import (
	"context"

	"{{MODULE}}/internal/modules/users/domain"
	"{{MODULE}}/internal/shared/apperr"
	"{{MODULE}}/internal/shared/auth"
	"{{MODULE}}/internal/shared/validate"
)

type SignUpInput struct {
	Email    string
	Password string
	FullName string
}

// SignUp registers a new user.
//
// The duplicate check runs against the NORMALISED email, matching what
// domain.NewUser will store — checking the raw input instead is how
// "Ada@Example.com" slips past a check for "ada@example.com" and creates a
// second account that then collides at the unique index.
func (s *Service) SignUp(ctx context.Context, in SignUpInput) (*domain.User, error) {
	if err := domain.ValidatePassword(in.Password); err != nil {
		return nil, err
	}

	existing, err := s.users.ByEmail(ctx, validate.NormalizeEmail(in.Email))
	if err != nil && apperr.KindOf(err) != apperr.KindNotFound {
		return nil, err
	}
	if existing != nil {
		return nil, apperr.Conflict("Email already registered")
	}

	hash, err := auth.HashPassword(in.Password)
	if err != nil {
		return nil, apperr.Internal("Failed to hash password", err)
	}

	user, err := domain.NewUser(in.Email, hash, in.FullName)
	if err != nil {
		return nil, err
	}
	if err := s.users.Create(ctx, user); err != nil {
		return nil, err
	}
	return user, nil
}
