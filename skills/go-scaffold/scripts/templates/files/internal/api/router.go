// Package api is the composition root for HTTP: it assembles the modules into
// the single interface oapi-codegen generates, and builds the router.
//
// It is the one package that knows which modules exist. Modules do not know
// about each other, and none of them knows about the router.
package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/gin-gonic/gin/binding"
	"github.com/go-playground/validator/v10"

	"{{MODULE}}/internal/api/middleware"
	"{{MODULE}}/internal/modules/users"
	"{{MODULE}}/internal/openapi"
	"{{MODULE}}/internal/shared/auth"
	"{{MODULE}}/internal/shared/httpx"
	"{{MODULE}}/internal/shared/validate"
)

// Options is everything NewRouter needs. A struct rather than a parameter list
// so cmd/server names each dependency at the call site, and so a test can
// supply exactly the ones its assertions touch and leave the rest zero.
type Options struct {
	// Spec is the contract, served verbatim at GET /openapi.yaml.
	Spec []byte
	// CORSOrigins is the resolved allowlist.
	CORSOrigins []string
	// TokenIssuer verifies bearer tokens for the protected prefixes.
	TokenIssuer auth.TokenIssuer
	// Ping backs GET /readyz. A nil Ping means "no database wired", which
	// reports unavailable rather than panicking.
	Ping func() error
	// Users is the users module. Add a field per module as they arrive.
	Users *users.Module
}

// NewRouter builds the fully wired router.
//
// It is deliberately split out of cmd/server so tests exercise the REAL wiring.
// The failure this guards against — a route prefix with no case in
// middleware.AuthByPath, leaving a protected route public — is invisible to the
// compiler and returns 200 the whole time. A test that assembled its own router
// would pass while production was open; see router_test.go.
func NewRouter(opts Options) *gin.Engine {
	// Register custom validation tags into the validator engine Gin uses for
	// ShouldBindJSON. This must happen before the first request is handled.
	if v, ok := binding.Validator.Engine().(*validator.Validate); ok {
		validate.RegisterCustomValidators(v)
	}

	r := gin.Default()
	r.Use(middleware.CORS(opts.CORSOrigins))

	// Liveness: the process is up. It never touches the database — a DB outage
	// must not get the container killed and restarted in a loop.
	r.GET("/healthz", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// Readiness: the process can actually serve traffic, i.e. the DB answers.
	r.GET("/readyz", func(c *gin.Context) {
		if opts.Ping == nil || opts.Ping() != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"status": "unavailable"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "ready"})
	})

	// Serve the contract itself — single source of truth.
	r.GET("/openapi.yaml", func(c *gin.Context) {
		c.Data(http.StatusOK, "application/yaml", opts.Spec)
	})

	// Routing is generated from openapi.yaml. SECURITY IS NOT: the generated
	// code ignores the contract's `security:` schemes, so auth and rate limits
	// are applied as selectors that match each route by path.
	openapi.RegisterHandlersWithOptions(r, newServer(opts.Users), openapi.GinServerOptions{
		BaseURL: middleware.BaseURL,
		Middlewares: []openapi.MiddlewareFunc{
			openapi.MiddlewareFunc(middleware.RateLimitByPath()),
			openapi.MiddlewareFunc(middleware.AuthByPath(opts.TokenIssuer)),
		},
		// The generated router's own parameter-binding errors use {"msg": ...}.
		// Route them through the same {"error": ...} shape as everything else,
		// so the API has exactly one error contract.
		ErrorHandler: func(c *gin.Context, err error, statusCode int) {
			httpx.Error(c, statusCode, err.Error())
		},
	})

	return r
}
