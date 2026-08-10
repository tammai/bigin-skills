package infrastructure

import (
	"context"
	"errors"

	"gorm.io/gorm"

	"{{MODULE}}/internal/modules/users/application"
	"{{MODULE}}/internal/modules/users/domain"
	"{{MODULE}}/internal/shared/apperr"
)

type UserRepository struct {
	db *gorm.DB
}

func NewUserRepository(db *gorm.DB) *UserRepository {
	return &UserRepository{db: db}
}

// The compile-time assertion is what makes the port real. Without it, a method
// renamed here and not in the port fails much later, at the wiring in
// module.go, with a far worse error message.
var _ application.UserRepository = (*UserRepository)(nil)

func (r *UserRepository) Create(ctx context.Context, u *domain.User) error {
	rec := userRecordOf(u)
	if err := r.db.WithContext(ctx).Create(&rec).Error; err != nil {
		return apperr.Internal("Failed to create user", err)
	}
	// Write the database-assigned ID and timestamps back, so the caller can
	// return the created resource without a second read.
	*u = rec.toDomain()
	return nil
}

func (r *UserRepository) Update(ctx context.Context, u *domain.User) error {
	rec := userRecordOf(u)
	if err := r.db.WithContext(ctx).Save(&rec).Error; err != nil {
		return apperr.Internal("Failed to update user", err)
	}
	*u = rec.toDomain()
	return nil
}

func (r *UserRepository) Delete(ctx context.Context, id uint) error {
	if err := r.db.WithContext(ctx).Delete(&userRecord{}, id).Error; err != nil {
		return apperr.Internal("Failed to delete user", err)
	}
	return nil
}

func (r *UserRepository) ByID(ctx context.Context, id uint) (*domain.User, error) {
	var rec userRecord
	if err := r.db.WithContext(ctx).First(&rec, id).Error; err != nil {
		return nil, translate(err, "User not found", "Failed to load user")
	}
	u := rec.toDomain()
	return &u, nil
}

func (r *UserRepository) ByEmail(ctx context.Context, email string) (*domain.User, error) {
	var rec userRecord
	if err := r.db.WithContext(ctx).Where("email = ?", email).First(&rec).Error; err != nil {
		return nil, translate(err, "User not found", "Failed to load user")
	}
	u := rec.toDomain()
	return &u, nil
}

// Page returns one page plus the unfiltered total. The count runs as its own
// query because the LIMIT on the page query would otherwise cap it.
func (r *UserRepository) Page(ctx context.Context, offset, limit int) ([]domain.User, int64, error) {
	var total int64
	if err := r.db.WithContext(ctx).Model(&userRecord{}).Count(&total).Error; err != nil {
		return nil, 0, apperr.Internal("Failed to count users", err)
	}

	var records []userRecord
	if err := r.db.WithContext(ctx).
		Limit(limit).
		Offset(offset).
		// A deterministic order is required, not cosmetic: without ORDER BY,
		// Postgres may return rows in a different order per query and paging
		// silently skips and repeats records.
		Order("id asc").
		Find(&records).Error; err != nil {
		return nil, 0, apperr.Internal("Failed to fetch users", err)
	}

	users := make([]domain.User, 0, len(records))
	for _, rec := range records {
		users = append(users, rec.toDomain())
	}
	return users, total, nil
}

// translate is the boundary that keeps gorm out of the rest of the module: a
// missing row becomes apperr.NotFound, and everything else becomes an internal
// error with a FIXED message, the driver's own text tucked into the cause where
// logs can see it and clients cannot.
func translate(err error, notFoundMsg, internalMsg string) error {
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return apperr.NotFound(notFoundMsg)
	}
	return apperr.Internal(internalMsg, err)
}
