.PHONY: generate build run test test-integration vet lint fmt tidy seed dev-setup migrate-up migrate-down migrate-status docker-build docker-up docker-down

APP_NAME := {{PROJECT_NAME}}
SQLC_VERSION := {{SQLC_VERSION}}
OAPI_CODEGEN_VERSION := {{OAPI_CODEGEN_VERSION}}

# Per-module filtered codegen (ADR §4.1): one openapi.yaml, one oapi-codegen run
# per module (each filtered to its tag), then sqlc for all modules.
generate:
	go run github.com/oapi-codegen/oapi-codegen/v2/cmd/oapi-codegen@$(OAPI_CODEGEN_VERSION) -config internal/users/internal/gen/oapi-codegen.yaml api/openapi.yaml
	go run github.com/oapi-codegen/oapi-codegen/v2/cmd/oapi-codegen@$(OAPI_CODEGEN_VERSION) -config internal/posts/internal/gen/oapi-codegen.yaml api/openapi.yaml
	go run github.com/sqlc-dev/sqlc/cmd/sqlc@$(SQLC_VERSION) generate

build:
	go build -o bin/server ./cmd/server

run:
	go run ./cmd/server

# Unit tests only — Docker-free. Integration tests live behind a build tag.
test:
	go test ./...

# Integration tests: spin up real Postgres via testcontainers-go (needs Docker),
# apply migrations, exercise the golden path through the HTTP handler.
test-integration:
	go test -tags integration ./...

vet:
	go vet ./...

# Lint hand-written code only. The oapi-codegen/sqlc output (internal/*/gen,
# infrastructure/db) is DO-NOT-EDIT generated code; staticcheck's generated-file
# auto-skip doesn't fire on oapi-codegen's marker (it's folded into the package
# doc comment), so exclude those packages explicitly rather than chase warnings
# in code we don't own.
lint:
	staticcheck $$(go list ./... | grep -vE '(/internal/gen|/infrastructure/db)$$')

fmt:
	gofmt -l -s -w .

tidy:
	go mod tidy

seed:
	go run ./cmd/seed

# One command to a working local stack (ADR §12): infra up, migrate, seed.
dev-setup:
	docker compose up -d db && $(MAKE) migrate-up && $(MAKE) seed

migrate-up:
	migrate -path db/migrations -database "$$DATABASE_URL" up

migrate-down:
	migrate -path db/migrations -database "$$DATABASE_URL" down 1

migrate-status:
	migrate -path db/migrations -database "$$DATABASE_URL" version

docker-build:
	docker build -t $(APP_NAME) .

docker-up:
	docker compose up --build

docker-down:
	docker compose down
