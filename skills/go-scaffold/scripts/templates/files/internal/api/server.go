package api

import (
	"{{MODULE}}/internal/modules/users"
	"{{MODULE}}/internal/openapi"
)

// server implements the generated openapi.ServerInterface by EMBEDDING each
// module's handlers.
//
// oapi-codegen generates one interface covering every operation in the
// contract, so a modular monolith has to reassemble the modules into it
// somewhere — this is that somewhere, and it is the only place that does it.
//
// Adding a module: embed its Handlers alias here. If two modules ever export
// the same method name, Go reports an ambiguous selector at compile time rather
// than silently picking one; resolve it by writing an explicit forwarding
// method on server.
type server struct {
	*users.Handlers
}

// The assertion that turns a contract change into a build failure. Add an
// operation to openapi.yaml, run `make generate`, and this line stops compiling
// until some module implements it.
var _ openapi.ServerInterface = (*server)(nil)

func newServer(u *users.Module) *server {
	return &server{Handlers: u.HTTPHandlers()}
}
