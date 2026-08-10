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
	"gorm.io/gorm"

	usersapi "{{MODULE}}/internal/modules/users/api"
	"{{MODULE}}/internal/modules/users/application"
	"{{MODULE}}/internal/modules/users/infrastructure"
	"{{MODULE}}/internal/shared/auth"
)

// Handlers is the module's HTTP surface, re-exported as an alias so the
// composition root can embed it into the generated ServerInterface without
// importing the module's api package directly.
type Handlers = usersapi.Handlers

// Module is the assembled module. New performs the module's own wiring — which
// repository backs which port, which use cases the handlers get — so the
// composition root only has to know that a users module exists.
type Module struct {
	handlers *Handlers
}

func New(db *gorm.DB, issuer auth.TokenIssuer) *Module {
	service := application.NewService(
		infrastructure.NewUserRepository(db),
		infrastructure.NewRefreshTokenRepository(db),
		issuer,
	)
	return &Module{handlers: usersapi.NewHandlers(service)}
}

func (m *Module) HTTPHandlers() *Handlers { return m.handlers }
