// Package db owns the GORM handle. It is deliberately tiny: opening a
// connection and answering "is it alive" are the only database concerns that
// are not a module's business. Queries live in each module's infrastructure
// package, against that module's own tables.
package db

import (
	"errors"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

// Open connects eagerly. GORM's Postgres driver dials during gorm.Open, so a
// bad DSN fails at boot instead of on the first request — /readyz exists for
// the database going away AFTER startup, not for starting without one.
func Open(dsn string) (*gorm.DB, error) {
	return gorm.Open(postgres.Open(dsn), &gorm.Config{})
}

// Ping backs GET /readyz.
//
// It is nil-safe on purpose: a router built without a database — which is every
// test in internal/api — must report "unavailable" rather than panic. That is
// the case a happy-path test never reaches and an outage always does.
func Ping(g *gorm.DB) error {
	if g == nil {
		return errors.New("database not initialised")
	}
	sqlDB, err := g.DB()
	if err != nil {
		return err
	}
	return sqlDB.Ping()
}
