// Package apperr is the application's error vocabulary.
//
// It exists so that a use case can say "this is a conflict" without importing
// net/http, and so that the mapping from failure to status code happens in
// exactly one place (httpx.Fail). The alternative — every layer picking its own
// status — is how an API ends up returning 500 for a missing row in one handler
// and 404 in the next.
//
// The package is named apperr rather than errors so that files here can use the
// standard library's errors.As without shadowing.
package apperr

import (
	"errors"
	"fmt"
)

// Kind classifies a failure by what the CALLER should do about it, not by which
// layer produced it. A repository returning KindNotFound and a domain rule
// returning KindInvalid both travel to the transport layer unchanged.
type Kind int

const (
	// KindInternal is the zero value on purpose: an error that never passed
	// through this package is, by definition, one nobody classified, and the
	// safe default for an unclassified failure is 500 with a fixed message.
	KindInternal Kind = iota
	KindInvalid
	KindUnauthorized
	KindForbidden
	KindNotFound
	KindConflict
)

// Error carries a message that is SAFE TO RETURN to the client.
//
// A database driver's error text can name tables, columns, and the DSN, so it
// is never the message — it goes in cause, stays available to errors.Is/As and
// the logs, and never reaches a response body.
type Error struct {
	Kind    Kind
	Message string
	cause   error
}

func (e *Error) Error() string {
	if e.cause != nil {
		return fmt.Sprintf("%s: %v", e.Message, e.cause)
	}
	return e.Message
}

func (e *Error) Unwrap() error { return e.cause }

// Invalid: the request itself is wrong (failed a domain rule or a policy).
func Invalid(message string) *Error { return &Error{Kind: KindInvalid, Message: message} }

// Unauthorized: the caller is not authenticated, or the credential is stale.
func Unauthorized(message string) *Error {
	return &Error{Kind: KindUnauthorized, Message: message}
}

// Forbidden: the caller is authenticated but not allowed to do this.
func Forbidden(message string) *Error { return &Error{Kind: KindForbidden, Message: message} }

// NotFound: the addressed resource does not exist.
func NotFound(message string) *Error { return &Error{Kind: KindNotFound, Message: message} }

// Conflict: the request collides with existing state (duplicate email, ...).
func Conflict(message string) *Error { return &Error{Kind: KindConflict, Message: message} }

// Internal takes a cause because an internal failure without one is an internal
// failure nobody can debug. The message is the fixed text the client will see.
func Internal(message string, cause error) *Error {
	return &Error{Kind: KindInternal, Message: message, cause: cause}
}

// KindOf classifies any error. An error that did not come from this package is
// KindInternal — unclassified means unknown, and unknown means 500.
//
// It uses errors.As rather than a type assertion so that a typed error wrapped
// on the way up the call chain still classifies correctly instead of silently
// degrading to 500.
func KindOf(err error) Kind {
	var e *Error
	if errors.As(err, &e) {
		return e.Kind
	}
	return KindInternal
}

// MessageOf returns the client-safe message for an error, falling back to a
// fixed string for anything this package did not produce. This fallback is the
// leak-proofing: an unwrapped driver error surfaces as "Internal server error",
// never as its own text.
func MessageOf(err error) string {
	var e *Error
	if errors.As(err, &e) {
		return e.Message
	}
	return "Internal server error"
}
