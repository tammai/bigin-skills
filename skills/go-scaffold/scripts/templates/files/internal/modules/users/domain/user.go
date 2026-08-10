// Package domain holds the users module's entities and the rules that must
// hold for them regardless of who is asking.
//
// It is the innermost layer: it imports no use case, no repository, no
// transport type, and neither gin nor gorm. internal/arch fails the build if
// that ever stops being true. The payoff is that the rules below can be read
// and tested on their own, and that changing the table or the contract does not
// touch them.
package domain

import (
	"time"

	"{{MODULE}}/internal/shared/apperr"
	"{{MODULE}}/internal/shared/auth"
	"{{MODULE}}/internal/shared/validate"
)

// User is the entity. Deliberately free of gorm and json tags: the persistence
// shape lives in infrastructure.userRecord and the wire shape is generated from
// openapi.yaml. Three separate shapes sounds like duplication until a column
// rename or a contract change has to happen without touching these rules.
type User struct {
	ID           uint
	Email        string
	PasswordHash string
	FullName     string
	Role         string
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

// NewUser applies every invariant that must hold for a user to exist at all:
// the email is normalised (so case cannot create a second account), the name is
// sanitised, and the role is FORCED — a client-supplied role is never trusted,
// and the only way to become an admin is UpdateUserRole.
func NewUser(email, passwordHash, fullName string) (*User, error) {
	normalized := validate.NormalizeEmail(email)
	if normalized == "" {
		return nil, apperr.Invalid("email is required")
	}
	name := validate.SanitizeText(fullName)
	if name == "" {
		return nil, apperr.Invalid("full_name is required")
	}
	if passwordHash == "" {
		// Reachable only from a caller that skipped hashing — a bug, not bad
		// input, so it must not surface as a 400 telling the client to retry.
		return nil, apperr.Internal("password hash is empty", nil)
	}

	return &User{
		Email:        normalized,
		PasswordHash: passwordHash,
		FullName:     name,
		Role:         auth.RoleUser,
	}, nil
}

// Rename is the only way full_name changes. Sanitising here rather than in the
// handler means every future caller gets it, including one that binds from
// somewhere other than JSON.
func (u *User) Rename(fullName string) error {
	name := validate.SanitizeText(fullName)
	if name == "" {
		return apperr.Invalid("full_name is required")
	}
	u.FullName = name
	return nil
}

// ChangeRole rejects anything outside the known vocabulary, so a typo in a
// request body cannot write a role that no authorization check will ever match
// — which would lock the account out of everything without failing anywhere.
func (u *User) ChangeRole(role string) error {
	if role != auth.RoleUser && role != auth.RoleAdmin {
		return apperr.Invalid("role must be one of: user, admin")
	}
	u.Role = role
	return nil
}
