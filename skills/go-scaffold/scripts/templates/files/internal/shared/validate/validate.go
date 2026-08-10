// Package validate holds the two text-hygiene layers every free-text field in
// the API passes through.
//
// They are deliberately separate and both are required:
//
//   - RegisterCustomValidators installs the "notags" binding tag, which rejects
//     markup at BIND time with a 400 that tells the client what was wrong.
//   - SanitizeText cleans at WRITE time, so anything that ever routes around
//     binding still can't put markup in the database.
//
// The first gives a usable error; the second keeps the data clean. Dropping
// either one leaves a gap that only shows up later, in whatever renders the
// data.
package validate

import (
	"regexp"
	"strings"

	"github.com/go-playground/validator/v10"
	"github.com/microcosm-cc/bluemonday"
)

var (
	htmlTagPattern = regexp.MustCompile(`<[^>]*>`)
	stripPolicy    = bluemonday.StrictPolicy()
	controlCharRE  = regexp.MustCompile(`[\x00-\x1F\x7F]`)
)

// RegisterCustomValidators registers custom validation tags into the validator
// engine Gin uses for ShouldBindJSON. It must run BEFORE the router handles its
// first request; internal/api.NewRouter is the one caller.
//
// The tags themselves are carried on the generated request types via
// x-oapi-codegen-extra-tags in openapi.yaml — the contract decides which fields
// get them, not the handler.
func RegisterCustomValidators(v *validator.Validate) {
	// "notags": reject input containing an HTML/script tag ("<script>",
	// "<img onerror=...>"). Apply it to free-text that will be rendered
	// somewhere else — full_name, bio, notes.
	_ = v.RegisterValidation("notags", func(fl validator.FieldLevel) bool {
		return !htmlTagPattern.MatchString(fl.Field().String())
	})
}

// SanitizeText strips HTML, removes control characters (which can break
// Postgres inserts), and collapses whitespace. It is the last thing that
// touches a free-text field before it is stored.
//
// This is not a substitute for output encoding in the frontend — React and Vue
// escape text on render, which is the real defense there. Sanitizing here
// protects the paths that DON'T escape: CSV exports, emails, an admin panel
// somebody wrote in a hurry.
func SanitizeText(input string) string {
	cleaned := stripPolicy.Sanitize(input)
	cleaned = controlCharRE.ReplaceAllString(cleaned, "")
	cleaned = strings.TrimSpace(cleaned)
	return strings.Join(strings.Fields(cleaned), " ")
}

// NormalizeEmail lowercases and trims, so "Ada@Example.COM" and
// "ada@example.com" cannot become two accounts and case cannot slip past a
// duplicate check.
func NormalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}
