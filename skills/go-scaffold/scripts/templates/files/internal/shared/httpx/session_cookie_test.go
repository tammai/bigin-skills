package httpx

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

func setCookieFrom(t *testing.T, w *httptest.ResponseRecorder) *http.Cookie {
	t.Helper()
	cookies := w.Result().Cookies()
	if len(cookies) != 1 {
		t.Fatalf("got %d Set-Cookie headers, want 1", len(cookies))
	}
	return cookies[0]
}

// Every attribute here is a defence: HttpOnly keeps script from reading the
// ID, Secure and the __Host- prefix keep it off plain HTTP and off sibling
// subdomains, SameSite=Lax keeps cross-site POSTs from carrying it.
func TestSessionCookieSetCarriesEveryAttribute(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)

	SessionCookie{Name: "__Host-session", Secure: true}.Set(c, "opaque", time.Now().Add(30*24*time.Hour))

	got := setCookieFrom(t, w)
	if got.Name != "__Host-session" || got.Value != "opaque" {
		t.Errorf("cookie = %s=%s, want __Host-session=opaque", got.Name, got.Value)
	}
	if !got.HttpOnly || !got.Secure || got.SameSite != http.SameSiteLaxMode || got.Path != "/" || got.Domain != "" {
		t.Errorf("cookie attributes = %+v, want HttpOnly, Secure, SameSite=Lax, Path=/, no Domain", got)
	}
	// Max-Age is the absolute lifetime, exactly — not a second short because
	// a few nanoseconds passed between computing the expiry and setting it.
	if want := 30 * 24 * 60 * 60; got.MaxAge != want {
		t.Errorf("Max-Age = %d, want %d", got.MaxAge, want)
	}
}

func TestSessionCookieClearExpiresIt(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)

	SessionCookie{Name: "session", Secure: false}.Clear(c)

	got := setCookieFrom(t, w)
	if got.Name != "session" || got.Value != "" || got.MaxAge >= 0 {
		t.Errorf("clear = %+v, want an empty session cookie with Max-Age=0", got)
	}
	if got.Secure {
		t.Error("insecure dev mode set Secure on the cookie")
	}
}

func TestSessionCookieRead(t *testing.T) {
	gin.SetMode(gin.TestMode)
	cookie := SessionCookie{Name: "__Host-session", Secure: true}

	for name, tc := range map[string]struct {
		header string
		want   string
		wantOK bool
	}{
		"present": {"__Host-session=abc", "abc", true},
		"absent":  {"", "", false},
		"empty":   {"__Host-session=", "", false},
		// The bare name is the insecure-mode cookie; a secure deployment must
		// not accept it, or a plain-HTTP response could plant one.
		"other name": {"session=abc", "", false},
	} {
		t.Run(name, func(t *testing.T) {
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Request = httptest.NewRequest(http.MethodGet, "/", nil)
			if tc.header != "" {
				c.Request.Header.Set("Cookie", tc.header)
			}
			got, ok := cookie.Read(c)
			if got != tc.want || ok != tc.wantOK {
				t.Errorf("Read() = (%q, %v), want (%q, %v)", got, ok, tc.want, tc.wantOK)
			}
		})
	}
}
