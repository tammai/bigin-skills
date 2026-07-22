// Package infrastructure implements the users module's application ports with
// pgx/v5 + sqlc-generated queries (the `db` subpackage). The domain layer speaks
// plain Go types (string ids, time.Time); this layer maps to/from pgx's pgtype
// scan types via shared/pgconv.
package infrastructure

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"{{MODULE}}/internal/shared/pgconv"
	"{{MODULE}}/internal/users/internal/application"
	"{{MODULE}}/internal/users/internal/domain"
	"{{MODULE}}/internal/users/internal/infrastructure/db"
)

type UsersRepository struct {
	q *db.Queries
}

func NewUsersRepository(pool *pgxpool.Pool) *UsersRepository {
	return &UsersRepository{q: db.New(pool)}
}

func toUser(r db.UsersUser) domain.User {
	return domain.User{
		ID:           pgconv.UUIDToString(r.ID),
		Email:        r.Email,
		Name:         r.Name,
		PasswordHash: r.PasswordHash,
		Roles:        r.Roles,
		CreatedAt:    pgconv.TimestamptzToTime(r.CreatedAt),
		UpdatedAt:    pgconv.TimestamptzToTime(r.UpdatedAt),
		Version:      int(r.Version),
		DeletedAt:    pgconv.TimestamptzToTimePtr(r.DeletedAt),
	}
}

func (r *UsersRepository) Create(ctx context.Context, p application.CreateUserParams) (domain.User, error) {
	row, err := r.q.CreateUser(ctx, db.CreateUserParams{
		ID:           pgconv.StringToUUID(pgconv.NewUUIDv7()),
		Email:        p.Email,
		Name:         p.Name,
		PasswordHash: p.PasswordHash,
		Roles:        p.Roles,
		CreatedBy:    pgconv.StringPtrToUUID(p.CreatedBy),
	})
	if err != nil {
		return domain.User{}, err
	}
	return toUser(row), nil
}

func (r *UsersRepository) FindByID(ctx context.Context, id string) (*domain.User, error) {
	row, err := r.q.GetUserByID(ctx, pgconv.StringToUUID(id))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	u := toUser(row)
	return &u, nil
}

func (r *UsersRepository) FindByEmail(ctx context.Context, email string) (*domain.User, error) {
	row, err := r.q.GetUserByEmail(ctx, email)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	u := toUser(row)
	return &u, nil
}

func (r *UsersRepository) FindManyByIDs(ctx context.Context, ids []string) ([]domain.User, error) {
	if len(ids) == 0 {
		return nil, nil
	}
	uuids := make([]pgtype.UUID, len(ids))
	for i, id := range ids {
		uuids[i] = pgconv.StringToUUID(id)
	}
	rows, err := r.q.GetUsersByIDs(ctx, uuids)
	if err != nil {
		return nil, err
	}
	users := make([]domain.User, len(rows))
	for i, row := range rows {
		users[i] = toUser(row)
	}
	return users, nil
}

func (r *UsersRepository) List(ctx context.Context, limit, offset int) ([]domain.User, error) {
	rows, err := r.q.ListUsers(ctx, db.ListUsersParams{Limit: int32(limit), Offset: int32(offset)})
	if err != nil {
		return nil, err
	}
	users := make([]domain.User, len(rows))
	for i, row := range rows {
		users[i] = toUser(row)
	}
	return users, nil
}

func (r *UsersRepository) SoftDelete(ctx context.Context, id, actorID string) (bool, error) {
	_, err := r.q.SoftDeleteUser(ctx, db.SoftDeleteUserParams{
		ID:        pgconv.StringToUUID(id),
		UpdatedBy: pgconv.StringToUUID(actorID),
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, nil
}
