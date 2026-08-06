package utils

import "testing"

func TestValidatePasswordComplexity(t *testing.T) {
	cases := []struct {
		name     string
		password string
		wantErr  bool
	}{
		{"valid", "Str0ng!pass", false},
		{"too short", "Ab1!xyz", true},
		{"no uppercase", "str0ng!pass", true},
		{"no lowercase", "STR0NG!PASS", true},
		{"no digit", "Strong!pass", true},
		{"no special", "Str0ngpass", true},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			err := ValidatePasswordComplexity(tc.password)
			if tc.wantErr && err == nil {
				t.Fatalf("ValidatePasswordComplexity(%q) = nil, want an error", tc.password)
			}
			if !tc.wantErr && err != nil {
				t.Fatalf("ValidatePasswordComplexity(%q) = %v, want nil", tc.password, err)
			}
		})
	}
}
