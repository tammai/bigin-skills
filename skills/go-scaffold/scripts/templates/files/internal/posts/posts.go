// Package posts is the posts module's ONLY public surface (ADR §4.1). Everything
// under internal/posts/internal/ is compiler-blocked from other modules. The
// exports here: Register(), and AnonymizeAuthor() — the synchronous cross-module
// hook users' erase use-case calls to scrub an erased author.
package posts

import (
	"context"
	"log/slog"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"{{MODULE}}/internal/posts/internal/api"
	"{{MODULE}}/internal/posts/internal/application"
	"{{MODULE}}/internal/posts/internal/gen"
	"{{MODULE}}/internal/posts/internal/infrastructure"
	"{{MODULE}}/internal/shared/apierror"
)

// UserDirectory is the cross-module dependency posts needs (users satisfies it):
// batch id→name for author-name read composition. Aliased from application so
// the composition root uses one name; posts still never imports the users module.
type UserDirectory = application.UserDirectory

type Module struct {
	svc    *application.Service
	logger *slog.Logger
}

func New(pool *pgxpool.Pool, users UserDirectory, logger *slog.Logger) *Module {
	return &Module{svc: application.NewService(infrastructure.New(pool), users), logger: logger}
}

// AnonymizeAuthor is the public surface users' erase use-case calls synchronously
// (ADR §8 cross-module erase). Satisfies users.PostAnonymizer.
func (m *Module) AnonymizeAuthor(ctx context.Context, userID string) error {
	return m.svc.AnonymizeAuthor(ctx, userID)
}

func (m *Module) Register(r chi.Router) {
	h := api.NewHandler(m.svc)
	reqErr, respErr := apierror.StrictHandlers(m.logger)
	strict := gen.NewStrictHandlerWithOptions(h, nil, gen.StrictHTTPServerOptions{
		RequestErrorHandlerFunc:  reqErr,
		ResponseErrorHandlerFunc: respErr,
	})
	gen.HandlerFromMux(strict, r)
}
