package server

import (
	"log/slog"

	"github.com/jackc/pgx/v5/pgxpool"

	"{{MODULE}}/internal/api"
	"{{MODULE}}/internal/config"
	"{{MODULE}}/internal/store"
)

type Server struct {
	store       store.Querier
	pool        *pgxpool.Pool
	logger      *slog.Logger
	cfg         config.Config
	openapiSpec []byte
}

var _ api.StrictServerInterface = (*Server)(nil)

func New(st store.Querier, pool *pgxpool.Pool, logger *slog.Logger, cfg config.Config, openapiSpec []byte) *Server {
	return &Server{store: st, pool: pool, logger: logger, cfg: cfg, openapiSpec: openapiSpec}
}
