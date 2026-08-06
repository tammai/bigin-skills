package utils

import (
	"regexp"
	"strings"

	"github.com/microcosm-cc/bluemonday"
)

var (
	stripPolicy   = bluemonday.StrictPolicy()
	controlCharRE = regexp.MustCompile(`[\x00-\x1F\x7F]`)
)

// SanitizeText strips all HTML/script tags, removes control characters (which
// can break inserts into Postgres), and normalizes whitespace. It serves as the
// final defense-in-depth layer for EVERY free-text field before it is stored in
// the DB (full_name, bio, notes, ...), preventing stored XSS when this data is
// later rendered in a frontend.
//
// NOTE: this is not a replacement for context-aware output encoding in the
// frontend (React/Vue escape text automatically when rendering, which is safe
// enough). Sanitizing here only guarantees the data is "clean" at write time,
// protecting against the data being reused elsewhere (CSV export, emails, or an
// admin panel that doesn't escape properly).
func SanitizeText(input string) string {
	cleaned := stripPolicy.Sanitize(input)
	cleaned = controlCharRE.ReplaceAllString(cleaned, "")
	cleaned = strings.TrimSpace(cleaned)
	cleaned = strings.Join(strings.Fields(cleaned), " ") // collapse consecutive spaces
	return cleaned
}

// NormalizeEmail lowercases and trims an email, so "Test@X.com" and
// "test@x.com" aren't treated as two different accounts, and case differences
// can't bypass the duplicate-email check.
func NormalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}
