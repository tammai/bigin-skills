.PHONY: generate run dev build test vet lint fmt tidy migrate-create migrate-up migrate-down migrate-version dev-setup docker-build docker-up docker-down

APP_NAME := {{PROJECT_NAME}}
OAPI_CODEGEN_VERSION := {{OAPI_CODEGEN_VERSION}}

# `-include` (not `include`): a fresh clone has no .env yet, and every target
# below that doesn't touch the database must still work without one.
-include .env
export

DB_URL := postgres://$(DB_USER):$(DB_PASSWORD)@$(DB_HOST):$(DB_PORT)/$(DB_NAME)?sslmode=$(DB_SSLMODE)

# openapi.yaml -> api/api.gen.go (gin server interface + request/response models).
# Pinned via `go run pkg@version` so the generator version is reproducible
# without adding it (and ~40 transitive deps) to this module's own go.mod.
generate:
	go run github.com/oapi-codegen/oapi-codegen/v2/cmd/oapi-codegen@$(OAPI_CODEGEN_VERSION) -config oapi-codegen.yaml openapi.yaml

run:
	go run .

# Hot reload. One-time install: go install github.com/air-verse/air@latest
dev:
	air

build:
	go build -o bin/server .

test:
	go test ./... -count=1

vet:
	go vet ./...

# Skips api/ — api.gen.go is oapi-codegen output, DO NOT EDIT, and staticcheck's
# generated-file heuristic doesn't recognise its marker.
lint:
	staticcheck $$(go list ./... | grep -v '/api$$')

fmt:
	gofmt -l -s -w .

tidy:
	go mod tidy

# golang-migrate CLI, one-time install:
#   go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest
migrate-create:
	migrate create -ext sql -dir migrations -seq $(name)

migrate-up:
	migrate -path migrations -database "$(DB_URL)" up

migrate-down:
	migrate -path migrations -database "$(DB_URL)" down $(or $(steps),1)

migrate-version:
	migrate -path migrations -database "$(DB_URL)" version

# One command to a working local stack: Postgres up, schema applied.
dev-setup:
	docker compose up -d db && sleep 3 && $(MAKE) migrate-up

docker-build:
	docker build -t $(APP_NAME) .

docker-up:
	docker compose up --build

docker-down:
	docker compose down
