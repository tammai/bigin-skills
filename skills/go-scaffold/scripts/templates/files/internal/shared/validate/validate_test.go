package validate

import "testing"

func TestSanitizeText(t *testing.T) {
	cases := []struct {
		name  string
		input string
		want  string
	}{
		{"strips script tags", "<script>alert(1)</script>Ada", "Ada"},
		{"strips markup but keeps text", "<b>Ada</b> Lovelace", "Ada Lovelace"},
		{"removes control characters", "Ada\x00\x1fLovelace", "AdaLovelace"},
		{"collapses whitespace", "  Ada   Lovelace  ", "Ada Lovelace"},
		{"leaves clean input alone", "Ada Lovelace", "Ada Lovelace"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := SanitizeText(tc.input); got != tc.want {
				t.Errorf("SanitizeText(%q) = %q, want %q", tc.input, got, tc.want)
			}
		})
	}
}

func TestNormalizeEmail(t *testing.T) {
	cases := map[string]string{
		"  Ada@Example.COM ": "ada@example.com",
		"ada@example.com":    "ada@example.com",
		"":                   "",
	}
	for input, want := range cases {
		if got := NormalizeEmail(input); got != want {
			t.Errorf("NormalizeEmail(%q) = %q, want %q", input, got, want)
		}
	}
}
