// Package pagination clamps offset/limit query params to a safe range. Kept in
// one place so the two module repositories don't each re-implement the same
// defaults/bounds (mirrors pgconv's rationale for sharing conversions).
package pagination

const (
	DefaultLimit = 20
	MaxLimit     = 100
)

func ClampLimit(limit *int) int {
	if limit == nil {
		return DefaultLimit
	}
	if *limit < 1 {
		return 1
	}
	if *limit > MaxLimit {
		return MaxLimit
	}
	return *limit
}

func ClampOffset(offset *int) int {
	if offset == nil || *offset < 0 {
		return 0
	}
	return *offset
}
