package main

import (
	"log"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/gin-gonic/gin/binding"
	"github.com/go-playground/validator/v10"

	"{{MODULE}}/api"
	"{{MODULE}}/config"
	"{{MODULE}}/handlers"
	"{{MODULE}}/middleware"
	"{{MODULE}}/utils"
)

// newRouter builds the fully wired router. It is deliberately split out of
// main() so tests can exercise the REAL wiring: the failure this guards against
// — a stale path prefix in middleware.AuthByPath silently making a protected
// route public — is invisible to the compiler. A test that rebuilt its own
// router would pass while production was wide open. See main_test.go.
func newRouter(specYAML []byte) *gin.Engine {
	// Register custom validation tags ("notags", ...) into the validator engine
	// Gin uses internally for ShouldBindJSON. Must happen BEFORE the router
	// handles its first request. The binding tags are carried on the generated
	// request types via x-oapi-codegen-extra-tags in openapi.yaml.
	if v, ok := binding.Validator.Engine().(*validator.Validate); ok {
		utils.RegisterCustomValidators(v)
	}

	r := gin.Default()
	r.Use(middleware.CORS())

	// Liveness: the process is up. Never touches the database — a DB outage must
	// not get the container killed and restarted in a loop.
	r.GET("/healthz", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// Readiness: the process can actually serve traffic, i.e. the DB answers.
	r.GET("/readyz", func(c *gin.Context) {
		if err := config.PingDB(); err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"status": "unavailable"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "ready"})
	})

	// Serve the contract itself — single source of truth.
	r.GET("/openapi.yaml", func(c *gin.Context) {
		c.Data(http.StatusOK, "application/yaml", specYAML)
	})

	// Routing is generated from openapi.yaml by oapi-codegen. Security is NOT
	// enforced by generated code, so auth/rate-limit are applied as selectors
	// that match each route by path.
	api.RegisterHandlersWithOptions(r, &handlers.Server{}, api.GinServerOptions{
		// The API version prefix lives here, not in openapi.yaml's paths. Routes are
		// registered as BaseURL + the spec path, so this value ends up inside
		// c.FullPath() — which is what the middleware selectors match on. Keep it in
		// sync with middleware/selector.go and openapi.yaml's `servers` URL.
		BaseURL: "/api/v1",
		Middlewares: []api.MiddlewareFunc{
			api.MiddlewareFunc(middleware.RateLimitByPath()),
			api.MiddlewareFunc(middleware.AuthByPath()),
		},
		// The generated router's param-binding errors use {"msg": ...}; route
		// them through the same {"error": ...} shape as the rest of the API.
		ErrorHandler: func(c *gin.Context, err error, statusCode int) {
			c.JSON(statusCode, gin.H{"error": err.Error()})
		},
	})

	return r
}

func main() {
	// Load .env first: everything below (DB DSN, CORS_ORIGINS, JWT_SECRET) reads
	// process env, and middleware.CORS() snapshots its allowlist at build time.
	config.LoadEnv()

	if os.Getenv("JWT_SECRET") == "" {
		log.Fatal("JWT_SECRET is not set — refusing to start with an empty signing key")
	}

	config.ConnectDB()

	// Load the contract from disk so GET /openapi.yaml can serve it.
	specYAML, err := os.ReadFile("openapi.yaml")
	if err != nil {
		log.Fatalf("Failed to read openapi.yaml: %v", err)
	}

	r := newRouter(specYAML)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8090"
	}
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("Server stopped: %v", err)
	}
}
