package auth

import "testing"

func TestCan(t *testing.T) {
	tests := []struct {
		name  string
		roles []string
		perm  Permission
		want  bool
	}{
		{"grants a permission the role has", []string{RoleUser}, PermPostsWrite, true},
		{"denies a permission the role lacks", []string{RoleUser}, PermUsersErase, false},
		{"grants admin the erase permission", []string{RoleAdmin}, PermUsersErase, true},
		{"ignores unknown roles", []string{"superuser"}, PermPostsWrite, false},
		{"any matching role grants", []string{"superuser", RoleUser}, PermPostsWrite, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := Can(tt.roles, tt.perm); got != tt.want {
				t.Fatalf("Can(%v, %q) = %v, want %v", tt.roles, tt.perm, got, tt.want)
			}
		})
	}
}
