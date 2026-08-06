package utils

import (
	"errors"
	"regexp"
)

var (
	hasUpper   = regexp.MustCompile(`[A-Z]`)
	hasLower   = regexp.MustCompile(`[a-z]`)
	hasDigit   = regexp.MustCompile(`[0-9]`)
	hasSpecial = regexp.MustCompile(`[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]`)
)

// ValidatePasswordComplexity: at least 8 characters, with an uppercase letter,
// a lowercase letter, a digit, and a special character.
func ValidatePasswordComplexity(password string) error {
	if len(password) < 8 {
		return errors.New("password must be at least 8 characters")
	}
	if !hasUpper.MatchString(password) {
		return errors.New("password must contain at least one uppercase letter")
	}
	if !hasLower.MatchString(password) {
		return errors.New("password must contain at least one lowercase letter")
	}
	if !hasDigit.MatchString(password) {
		return errors.New("password must contain at least one digit")
	}
	if !hasSpecial.MatchString(password) {
		return errors.New("password must contain at least one special character")
	}
	return nil
}
