package utils

import "testing"

func TestSanitizeText(t *testing.T) {
	cases := []struct {
		name  string
		input string
		want  string
	}{
		{"strips script tags", `<script>alert(1)</script>Ada`, "Ada"},
		{"strips markup but keeps text", `<b>Grace</b> Hopper`, "Grace Hopper"},
		{"removes control characters", "Ada\x00\x07Lovelace", "AdaLovelace"},
		{"collapses whitespace", "  Ada   Lovelace  ", "Ada Lovelace"},
		{"leaves clean input alone", "Ada Lovelace", "Ada Lovelace"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := SanitizeText(tc.input); got != tc.want {
				t.Fatalf("SanitizeText(%q) = %q, want %q", tc.input, got, tc.want)
			}
		})
	}
}

func TestNormalizeEmail(t *testing.T) {
	// Case and surrounding whitespace must not create a second account that
	// slips past the duplicate-email check in SignUp.
	if got := NormalizeEmail("  Ada@Example.COM "); got != "ada@example.com" {
		t.Fatalf("NormalizeEmail = %q, want %q", got, "ada@example.com")
	}
}
