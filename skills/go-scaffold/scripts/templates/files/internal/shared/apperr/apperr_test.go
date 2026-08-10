package apperr

import (
	"errors"
	"fmt"
	"testing"
)

func TestKindOfClassifiesTypedErrors(t *testing.T) {
	cases := []struct {
		name string
		err  error
		want Kind
	}{
		{"invalid", Invalid("bad"), KindInvalid},
		{"unauthorized", Unauthorized("nope"), KindUnauthorized},
		{"forbidden", Forbidden("nope"), KindForbidden},
		{"not found", NotFound("gone"), KindNotFound},
		{"conflict", Conflict("dup"), KindConflict},
		{"internal", Internal("boom", errors.New("driver")), KindInternal},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := KindOf(tc.err); got != tc.want {
				t.Errorf("KindOf = %v, want %v", got, tc.want)
			}
		})
	}
}

// The default is the whole point: an error nobody classified must not be
// guessed at, and 500 is the only answer that can't leak or mislead.
func TestKindOfDefaultsToInternalForUnknownErrors(t *testing.T) {
	if got := KindOf(errors.New("some driver failure")); got != KindInternal {
		t.Errorf("KindOf(plain error) = %v, want KindInternal", got)
	}
	if got := KindOf(nil); got != KindInternal {
		t.Errorf("KindOf(nil) = %v, want KindInternal", got)
	}
}

// A typed error that got wrapped on the way up must still classify — this is
// why KindOf uses errors.As rather than a type assertion.
func TestKindOfSeesThroughWrapping(t *testing.T) {
	wrapped := fmt.Errorf("loading profile: %w", NotFound("User not found"))
	if got := KindOf(wrapped); got != KindNotFound {
		t.Errorf("KindOf(wrapped) = %v, want KindNotFound", got)
	}
	if got := MessageOf(wrapped); got != "User not found" {
		t.Errorf("MessageOf(wrapped) = %q, want the inner message", got)
	}
}

// The leak test. A driver error names tables, columns, and sometimes the DSN;
// none of that may become a response body.
func TestMessageOfNeverEchoesAnUnclassifiedError(t *testing.T) {
	driver := errors.New(`pq: relation "users" does not exist (host=db user=admin)`)

	if got := MessageOf(driver); got != "Internal server error" {
		t.Errorf("MessageOf(driver error) = %q — an unclassified error must not reach the client", got)
	}

	// Wrapped as Internal, the cause stays reachable for logs but the client
	// still only sees the fixed message.
	wrapped := Internal("Database error", driver)
	if got := MessageOf(wrapped); got != "Database error" {
		t.Errorf("MessageOf = %q, want the fixed message", got)
	}
	if !errors.Is(errors.Unwrap(wrapped), driver) {
		t.Error("the cause must stay reachable via Unwrap for logging")
	}
}
