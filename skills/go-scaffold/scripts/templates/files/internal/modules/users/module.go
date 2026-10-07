// Package users is the users module's PUBLIC CONTRACT — the only part of the
// module anything outside it may import.
//
// Everything under internal/modules/users/{domain,application,infrastructure,
// api} is private to the module. That is not a naming convention: internal/arch
// fails `go test ./...` on any import of those subpackages from outside this
// directory, including from the composition root.
//
// The payoff is that the module's internals are free to change — rename a
// column, split a use case, swap the repository — as long as this file keeps
// its shape.
//
// # Adding a second module
//
// Copy this directory's structure (domain, application, infrastructure, api,
// module.go), then wire it in internal/api/server.go. When it needs data from
// this one, DO NOT import the repository or the entity. Add a method here that
// returns a plain, transport-neutral struct, and make it a BATCH method:
//
//	func (m *Module) NamesByIDs(ctx context.Context, ids []uint) (map[uint]string, error)
//
// Batch, because the caller is almost always decorating a list, and a per-ID
// method turns that into an N+1 the module boundary happily hides.
package users

import (
	"time"

	"gorm.io/gorm"

	usersapi "{{MODULE}}/internal/modules/users/api"
	"{{MODULE}}/internal/modules/users/application"
	"{{MODULE}}/internal/modules/users/domain"
	"{{MODULE}}/internal/modules/users/infrastructure"
	"{{MODULE}}/internal/shared/auth"
	"{{MODULE}}/internal/shared/httpx"
)

// Handlers is the module's HTTP surface, re-exported as an alias so the
// composition root can embed it into the generated ServerInterface without
// importing the module's api package directly.
type Handlers = usersapi.Handlers

// Options is the module's configuration, resolved from the environment by
// cmd/server. Plain types only: this file is the module's public contract, and
// a field typed from domain would force every caller to import a package the
// encapsulation rule says it may not.
type Options struct {
	// SessionIdleTTL and SessionAbsoluteTTL bound a browser session: the first
	// slides with activity, the second never moves.
	SessionIdleTTL     time.Duration
	SessionAbsoluteTTL time.Duration
	// SessionCookie names the cookie and decides whether it is Secure.
	SessionCookie httpx.SessionCookie
}

// Module is the assembled module. New performs the module's own wiring — which
// repository backs which port, which use cases the handlers get — so the
// composition root only has to know that a users module exists.
type Module struct {
	handlers *Handlers
	service  *application.Service
}

func New(db *gorm.DB, issuer auth.TokenIssuer, opts Options) *Module {
	service := application.NewService(
		infrastructure.NewUserRepository(db),
		infrastructure.NewRefreshTokenRepository(db),
		infrastructure.NewSessionRepository(db),
		issuer,
		domain.SessionPolicy{IdleTTL: opts.SessionIdleTTL, AbsoluteTTL: opts.SessionAbsoluteTTL},
	)
	return &Module{
		handlers: usersapi.NewHandlers(service, opts.SessionCookie),
		service:  service,
	}
}

func (m *Module) HTTPHandlers() *Handlers { return m.handlers }

// Sessions is the module's browser-session lookup, handed to the auth
// middleware as the kernel's interface. The middleware sees a capability, not
// the module — which is what keeps internal/api/middleware free of any module
// import.
func (m *Module) Sessions() auth.SessionResolver { return m.service }
