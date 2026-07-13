.PHONY: generate build run test vet lint fmt tidy migrate-up migrate-down migrate-status docker-build docker-up docker-down

APP_NAME := {{PROJECT_NAME}}
SQLC_VERSION := {{SQLC_VERSION}}
OAPI_CODEGEN_VERSION := {{OAPI_CODEGEN_VERSION}}

generate:
	go run github.com/oapi-codegen/oapi-codegen/v2/cmd/oapi-codegen@$(OAPI_CODEGEN_VERSION) -config oapi-codegen.yaml openapi.yaml
	go run github.com/sqlc-dev/sqlc/cmd/sqlc@$(SQLC_VERSION) generate

build:
	go build -o bin/server ./cmd/server

run:
	go run ./cmd/server

test:
	go test ./...

vet:
	go vet ./...

lint:
	staticcheck ./...

fmt:
	gofmt -l -s -w .

tidy:
	go mod tidy

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
