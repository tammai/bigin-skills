package apierror

// One registry of stable, machine-readable error codes (ADR §9.1). The frontend
// switches on `code`, never on `message` text. Codes are module-prefixed where
// they belong to a module (users.*, posts.*). This list mirrors the enum in
// api/openapi.yaml's Error component — keep them in sync.
const (
	CodeBadRequest          = "bad_request"
	CodeUnauthenticated     = "unauthenticated"
	CodeUnauthorized        = "unauthorized"
	CodeNotFound            = "not_found"
	CodeConflict            = "conflict"
	CodeUnprocessableEntity = "unprocessable_entity"
	CodeRateLimited         = "rate_limited"
	CodeInternal            = "internal_error"
	CodeValidationFailed    = "validation_failed"

	CodeUserNotFound        = "users.not_found"
	CodeUserEmailTaken      = "users.email_taken"
	CodeInvalidCredentials  = "users.invalid_credentials"
	CodeInvalidRefreshToken = "users.invalid_refresh_token"
	CodePostNotFound        = "posts.not_found"
	CodePostVersionConflict = "posts.version_conflict"
)
