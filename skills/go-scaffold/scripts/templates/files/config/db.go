package config

import (
	"errors"
	"fmt"
	"log"
	"os"

	"github.com/joho/godotenv"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

// DB is the process-wide GORM handle. Handlers use it directly — there is no
// repository layer in this scaffold, on purpose: the contract (openapi.yaml)
// is the boundary that matters, and a second hand-written indirection over
// GORM buys nothing until a real second data source shows up.
var DB *gorm.DB

// LoadEnv reads .env into the process environment. Call it once, first thing in
// main(), before anything reads os.Getenv. Missing .env is not an error — in
// containers and CI the variables come from the environment itself.
func LoadEnv() {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using system environment variables")
	}
}

func ConnectDB() {
	dsn := fmt.Sprintf(
		"host=%s user=%s password=%s dbname=%s port=%s sslmode=%s TimeZone=UTC",
		os.Getenv("DB_HOST"), os.Getenv("DB_USER"), os.Getenv("DB_PASSWORD"),
		os.Getenv("DB_NAME"), os.Getenv("DB_PORT"), os.Getenv("DB_SSLMODE"),
	)

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("Database connection error: %v", err)
	}

	DB = db
	log.Println("Connected to PostgreSQL successfully.")
}

// PingDB backs GET /readyz. It returns an error (rather than logging or
// exiting) so the caller decides the HTTP status — and it tolerates a nil DB,
// which is the state during tests that never call ConnectDB.
func PingDB() error {
	if DB == nil {
		return errors.New("database not initialised")
	}
	sqlDB, err := DB.DB()
	if err != nil {
		return err
	}
	return sqlDB.Ping()
}
