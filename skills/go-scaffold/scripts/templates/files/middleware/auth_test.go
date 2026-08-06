package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

func signHS256(t *testing.T, claims jwt.MapClaims, secret string) string {
	t.Helper()
	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(secret))
	if err != nil {
		t.Fatalf("signing test token: %v", err)
	}
	return token
}

func runWithAuth(t *testing.T, requiredRole, authHeader string) *httptest.ResponseRecorder {
	t.Helper()
	gin.SetMode(gin.TestMode)

	r := gin.New()
	r.GET("/probe", AuthMiddleware(requiredRole), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"user_id": c.GetUint("userID"), "role": c.GetString("userRole")})
	})

	req := httptest.NewRequest(http.MethodGet, "/probe", nil)
	if authHeader != "" {
		req.Header.Set("Authorization", authHeader)
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func TestAuthMiddlewareRejectsMissingOrMalformedHeader(t *testing.T) {
	t.Setenv("JWT_SECRET", "test-secret")

	for _, header := range []string{"", "token-without-scheme", "Basic abc"} {
		if code := runWithAuth(t, "user", header).Code; code != http.StatusUnauthorized {
			t.Errorf("Authorization %q returned %d, want 401", header, code)
		}
	}
}

// jwt.Parse defaults to accepting any algorithm the token declares. Without the
// explicit SigningMethodHMAC check, an attacker-supplied RS256/none token would
// be trusted — this asserts the keyfunc actually rejects it.
func TestAuthMiddlewareRejectsAlgorithmConfusion(t *testing.T) {
	t.Setenv("JWT_SECRET", "test-secret")

	unsigned, err := jwt.NewWithClaims(jwt.SigningMethodNone, jwt.MapClaims{
		"user_id": 1.0, "role": "admin", "exp": time.Now().Add(time.Hour).Unix(),
	}).SignedString(jwt.UnsafeAllowNoneSignatureType)
	if err != nil {
		t.Fatalf("building alg=none token: %v", err)
	}

	if code := runWithAuth(t, "user", "Bearer "+unsigned).Code; code != http.StatusUnauthorized {
		t.Errorf("alg=none token returned %d, want 401", code)
	}
}

func TestAuthMiddlewareRejectsExpiredAndForeignSecret(t *testing.T) {
	t.Setenv("JWT_SECRET", "test-secret")

	expired := signHS256(t, jwt.MapClaims{
		"user_id": 1.0, "role": "user", "exp": time.Now().Add(-time.Minute).Unix(),
	}, "test-secret")
	if code := runWithAuth(t, "user", "Bearer "+expired).Code; code != http.StatusUnauthorized {
		t.Errorf("expired token returned %d, want 401", code)
	}

	foreign := signHS256(t, jwt.MapClaims{
		"user_id": 1.0, "role": "user", "exp": time.Now().Add(time.Hour).Unix(),
	}, "other-secret")
	if code := runWithAuth(t, "user", "Bearer "+foreign).Code; code != http.StatusUnauthorized {
		t.Errorf("token signed with a foreign secret returned %d, want 401", code)
	}
}

func TestAuthMiddlewareEnforcesRole(t *testing.T) {
	t.Setenv("JWT_SECRET", "test-secret")

	userToken := "Bearer " + signHS256(t, jwt.MapClaims{
		"user_id": 7.0, "role": "user", "exp": time.Now().Add(time.Hour).Unix(),
	}, "test-secret")
	adminToken := "Bearer " + signHS256(t, jwt.MapClaims{
		"user_id": 9.0, "role": "admin", "exp": time.Now().Add(time.Hour).Unix(),
	}, "test-secret")

	if code := runWithAuth(t, "user", userToken).Code; code != http.StatusOK {
		t.Errorf("user token on a user route returned %d, want 200", code)
	}
	if code := runWithAuth(t, "admin", userToken).Code; code != http.StatusForbidden {
		t.Errorf("user token on an admin route returned %d, want 403", code)
	}
	// Admin is deliberately a superset: it passes role-scoped routes too.
	if code := runWithAuth(t, "user", adminToken).Code; code != http.StatusOK {
		t.Errorf("admin token on a user route returned %d, want 200", code)
	}
}
