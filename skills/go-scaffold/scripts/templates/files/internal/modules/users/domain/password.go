package domain

import (
	"regexp"

	"{{MODULE}}/internal/shared/apperr"
)

var (
	hasUpper   = regexp.MustCompile(`[A-Z]`)
	hasLower   = regexp.MustCompile(`[a-z]`)
	hasDigit   = regexp.MustCompile(`[0-9]`)
	hasSpecial = regexp.MustCompile(`[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]`)
)

// ValidatePassword is the password POLICY, which is a rule about this product's
// users — so it lives in the domain. The hashing MECHANISM (bcrypt) is a
// cross-cutting capability and lives in shared/auth. Keeping the two apart is
// what lets the policy change without touching crypto, and vice versa.
//
// Each failure names the missing character class: "password is too weak" tells
// the user nothing they can act on.
func ValidatePassword(password string) error {
	if len(password) < 8 {
		return apperr.Invalid("password must be at least 8 characters")
	}
	if !hasUpper.MatchString(password) {
		return apperr.Invalid("password must contain at least one uppercase letter")
	}
	if !hasLower.MatchString(password) {
		return apperr.Invalid("password must contain at least one lowercase letter")
	}
	if !hasDigit.MatchString(password) {
		return apperr.Invalid("password must contain at least one digit")
	}
	if !hasSpecial.MatchString(password) {
		return apperr.Invalid("password must contain at least one special character")
	}
	return nil
}
