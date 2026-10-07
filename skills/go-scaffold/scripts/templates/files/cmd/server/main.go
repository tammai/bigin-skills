// Command server is the application entrypoint and the composition root.
//
// It is the only place that reads the environment, opens the database, and
// knows which modules exist. Everything below it receives what it needs as an
// argument — which is what lets the module packages be tested without a
// database, an .env file, or a live router.
package main

import (
	"log"
	"os"

	"{{MODULE}}/internal/api"
	"{{MODULE}}/internal/modules/users"
	"{{MODULE}}/internal/shared/auth"
	"{{MODULE}}/internal/shared/config"
	"{{MODULE}}/internal/shared/db"
	"{{MODULE}}/internal/shared/httpx"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	// GORM dials during Open, so a bad DSN fails here rather than on the first
	// request.
	gormDB, err := db.Open(cfg.DatabaseDSN)
	if err != nil {
		log.Fatalf("database: %v", err)
	}
	log.Println("Connected to PostgreSQL successfully.")

	// The contract is read from disk so GET /openapi.yaml can serve it.
	spec, err := os.ReadFile("openapi.yaml")
	if err != nil {
		log.Fatalf("read openapi.yaml: %v", err)
	}

	issuer := auth.NewTokenIssuer(cfg.JWTSecret, cfg.AccessTokenTTL, cfg.RefreshTokenTTL)
	sessionCookie := httpx.SessionCookie{Name: cfg.SessionCookieName, Secure: cfg.SessionCookieSecure}

	// One line per module. Adding a module means adding it here and embedding
	// its handlers in internal/api/server.go.
	usersModule := users.New(gormDB, issuer, users.Options{
		SessionIdleTTL:     cfg.SessionIdleTTL,
		SessionAbsoluteTTL: cfg.SessionAbsoluteTTL,
		SessionCookie:      sessionCookie,
	})

	router := api.NewRouter(api.Options{
		Spec:          spec,
		CORSOrigins:   cfg.CORSOrigins,
		TokenIssuer:   issuer,
		Sessions:      usersModule.Sessions(),
		SessionCookie: sessionCookie,
		WebOrigins:    cfg.WebOrigins,
		Ping:          func() error { return db.Ping(gormDB) },
		Users:         usersModule,
	})

	log.Printf("listening on :%s", cfg.Port)
	if err := router.Run(":" + cfg.Port); err != nil {
		log.Fatalf("Server stopped: %v", err)
	}
}
