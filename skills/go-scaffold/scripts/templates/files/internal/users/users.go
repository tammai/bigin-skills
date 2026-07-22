// Package users is the users module's ONLY public surface (ADR §4.1). Everything
// under internal/users/internal/ is compiler-blocked from every other module;
// the only things reachable from outside are the exports here: the module's
// Register() and its narrow read-composition method GetManyByIDs. These are
// in-process function calls (a modular monolith), not network RPCs.
package users

import (
	"context"
	"log/slog"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"{{MODULE}}/internal/shared/apierror"
	"{{MODULE}}/internal/shared/auth"
	"{{MODULE}}/internal/shared/config"
	"{{MODULE}}/internal/users/internal/api"
	"{{MODULE}}/internal/users/internal/application"
	"{{MODULE}}/internal/users/internal/gen"
	"{{MODULE}}/internal/users/internal/infrastructure"
)

// PostAnonymizer is the cross-module dependency users' erase use-case calls
// (posts satisfies it). Aliased from application so the composition root uses one
// name; users still never imports the posts module.
type PostAnonymizer = application.PostAnonymizer

type Module struct {
	svc    *application.Service
	jwt    *auth.JWT
	logger *slog.Logger
}

func New(pool *pgxpool.Pool, jwt *auth.JWT, hasher auth.PasswordHasher, cfg config.Config, logger *slog.Logger) *Module {
	svc := application.NewService(
		infrastructure.NewUsersRepository(pool),
		infrastructure.NewRefreshTokenRepository(pool),
		hasher,
		cfg.JWTRefreshTTLDays,
	)
	return &Module{svc: svc, jwt: jwt, logger: logger}
}

// UsePosts injects the cross-module post-anonymizer. The composition root calls
// this after both modules exist, before serving traffic.
func (m *Module) UsePosts(p PostAnonymizer) { m.svc.UsePostAnonymizer(p) }

// GetManyByIDs is the batch-get read-composition surface (id→name) posts uses to
// resolve author names for a whole list page in ONE call (ADR §4.2, no N+1).
func (m *Module) GetManyByIDs(ctx context.Context, ids []string) (map[string]string, error) {
	return m.svc.GetManyByIDs(ctx, ids)
}

// Register mounts this module's routes (from the single api/openapi.yaml, filtered
// to the `users` tag) onto r. Errors flow through apierror's central handlers.
func (m *Module) Register(r chi.Router) {
	h := api.NewHandler(m.svc, m.jwt)
	reqErr, respErr := apierror.StrictHandlers(m.logger)
	strict := gen.NewStrictHandlerWithOptions(h, nil, gen.StrictHTTPServerOptions{
		RequestErrorHandlerFunc:  reqErr,
		ResponseErrorHandlerFunc: respErr,
	})
	gen.HandlerFromMux(strict, r)
}
