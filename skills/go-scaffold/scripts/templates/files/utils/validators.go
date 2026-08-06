package utils

import (
	"regexp"

	"github.com/go-playground/validator/v10"
)

var htmlTagPattern = regexp.MustCompile(`<[^>]*>`)

// RegisterCustomValidators registers custom validation tags shared across the
// whole app. Call it once at server startup (in main.go), before any request is
// handled.
func RegisterCustomValidators(v *validator.Validate) {
	// "notags": rejects at the binding step if the input contains an HTML/script
	// tag (e.g. "<script>", "<img onerror=...>"). Apply it to free-text fields
	// that will be rendered elsewhere (full_name, bio, ...).
	// This is the INPUT validation layer — unlike SanitizeText (utils/sanitize.go),
	// which is the FINAL cleanup layer before persisting to the DB. The two
	// layers complement each other: notags returns a clear error telling the
	// client why the input was rejected, while SanitizeText keeps the data
	// clean even if a request slips through.
	v.RegisterValidation("notags", func(fl validator.FieldLevel) bool {
		return !htmlTagPattern.MatchString(fl.Field().String())
	})
}
