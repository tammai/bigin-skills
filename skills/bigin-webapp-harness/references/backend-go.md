# Backend (Go) Stack Spec
# Đặc tả stack Backend Go

## Stack Overview

| Layer | Technology |
|-------|-----------|
| Language | Go (latest stable) |
| HTTP Router | Gin (`github.com/gin-gonic/gin`) |
| Structure | Standard Go project layout |
| Config | Environment variables via `os.Getenv` or `godotenv` |
| Testing | `testing` stdlib + `testify` |

Gin provides routing, middleware, and request binding/validation out of the box. `gin.Default()` wires the Logger and Recovery middleware for you.
*Gin cung cấp routing, middleware, và request binding/validation sẵn có. `gin.Default()` tự động bật Logger và Recovery middleware.*

No specific ORM or database is prescribed by default — the architect agent decides based on project needs.  
*Không có ORM hay database cụ thể mặc định — architect agent quyết định dựa trên yêu cầu dự án.*

---

## Project Layout (Standard Go)

```
project/
├── cmd/
│   └── server/
│       └── main.go        ← entry point, builds *gin.Engine
├── internal/
│   ├── handler/           ← Gin handlers + route registration
│   ├── middleware/        ← Gin middleware (gin.HandlerFunc)
│   ├── service/           ← business logic
│   ├── repository/        ← data access layer
│   └── model/             ← domain models / DTOs
├── pkg/                   ← reusable public packages
├── migrations/            ← SQL migrations (if DB used)
├── .env.example
├── go.mod
├── go.sum
└── Makefile
```

---

## main.go (baseline with Gin)

```go
package main

import (
    "log"
    "net/http"
    "os"

    "github.com/gin-gonic/gin"

    "your-module-name/internal/handler"
)

func main() {
    r := gin.Default() // Logger + Recovery middleware

    r.GET("/health", func(c *gin.Context) {
        c.JSON(http.StatusOK, gin.H{"status": "ok"})
    })

    // Wire domain handlers
    handler.RegisterRoutes(r, /* injected handlers */)

    port := os.Getenv("PORT")
    if port == "" {
        port = "8080"
    }

    log.Printf("Server listening on :%s", port)
    if err := r.Run(":" + port); err != nil {
        log.Fatal(err)
    }
}
```

`r.Run()` starts the HTTP server on the given address. Use `gin.New()` (no default middleware) when you want full control over the middleware stack.

---

## Handler Pattern

Gin handlers take a single `*gin.Context` argument. Read path/query params via `c.Param` / `c.Query`, and respond via `c.JSON`.

```go
// internal/handler/user.go
package handler

import (
    "net/http"

    "github.com/gin-gonic/gin"
)

type UserHandler struct {
    svc UserService
}

func NewUserHandler(svc UserService) *UserHandler {
    return &UserHandler{svc: svc}
}

func (h *UserHandler) GetUser(c *gin.Context) {
    id := c.Param("id")
    user, err := h.svc.GetByID(c.Request.Context(), id)
    if err != nil {
        c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
        return
    }
    c.JSON(http.StatusOK, user)
}
```

### Request binding & validation

Gin binds and validates the request body in one step using struct tags (`binding:"..."` runs `go-playground/validator`).

```go
type createUserRequest struct {
    Name  string `json:"name" binding:"required"`
    Email string `json:"email" binding:"required,email"`
}

func (h *UserHandler) CreateUser(c *gin.Context) {
    var req createUserRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    user, err := h.svc.Create(c.Request.Context(), req.Name, req.Email)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        return
    }

    c.JSON(http.StatusCreated, user)
}
```

Prefer `c.ShouldBindJSON` (returns the error, handler owns the response shape) over `c.BindJSON` (auto-aborts with 400).

---

## Route Registration

```go
// internal/handler/router.go
package handler

import "github.com/gin-gonic/gin"

func RegisterRoutes(r *gin.Engine, uh *UserHandler /*, other handlers */) {
    api := r.Group("/api/v1")
    {
        api.GET("/users/:id", uh.GetUser)
        api.POST("/users", uh.CreateUser)
    }
}
```

Group routes by API version (`/api/v1`) and attach middleware per group via `api.Use(...)`.

---

## Middleware Pattern (Gin)

Gin middleware is a `gin.HandlerFunc` that calls `c.Next()` to continue the chain (or `c.Abort*()` to stop it).

```go
// internal/middleware/auth.go
package middleware

import (
    "net/http"

    "github.com/gin-gonic/gin"
)

func AuthRequired() gin.HandlerFunc {
    return func(c *gin.Context) {
        token := c.GetHeader("Authorization")
        if token == "" {
            c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing token"})
            return
        }
        // verify token, then stash the user id on the context
        c.Set("userID", "123")
        c.Next()
    }
}
```

Apply globally (`r.Use(middleware.AuthRequired())`) or to a single group (`api.Use(...)`).

---

## Service Layer Pattern

```go
// internal/service/user.go
package service

import "context"

type UserService interface {
    GetByID(ctx context.Context, id string) (*User, error)
}

type userService struct {
    repo UserRepository
}

func NewUserService(repo UserRepository) UserService {
    return &userService{repo: repo}
}
```

---

## Makefile (standard commands)

> Recipes must be indented with **tabs**, not spaces.

```makefile
.PHONY: dev build test tidy lint

dev:
	go run ./cmd/server

build:
	go build -o bin/server ./cmd/server

test:
	go test ./...

tidy:
	go mod tidy

lint:
	golangci-lint run
```

---

## Go Conventions

- All errors are returned, never swallowed silently
- Use `context.Context` as first parameter in all service/repository methods (pass `c.Request.Context()` from the handler)
- No global state — inject dependencies via constructors
- Package names: lowercase, single word (e.g. `handler`, `service`, `repository`)
- Exported types: PascalCase
- JSON field tags: snake_case (`json:"user_id"`)
- Validate input in handlers with Gin binding tags (`binding:"required,email"`) before calling the service layer

---

## Testing

```go
// internal/handler/user_test.go
func TestGetUser(t *testing.T) {
    gin.SetMode(gin.TestMode) // silence logs, disable color output

    mockSvc := &MockUserService{}
    h := NewUserHandler(mockSvc)

    r := gin.New()
    r.GET("/users/:id", h.GetUser)

    req := httptest.NewRequest(http.MethodGet, "/users/1", nil)
    w := httptest.NewRecorder()

    r.ServeHTTP(w, req)

    assert.Equal(t, http.StatusOK, w.Code)
}
```

- Always call `gin.SetMode(gin.TestMode)` in tests to silence logs and disable color output
- Drive handlers through a real `*gin.Engine` + `httptest.NewRecorder` so path params and binding run for real
- Unit test each handler, service, and repository independently
- Use interfaces for all dependencies to enable mocking
- Integration tests go in `_test` packages

---

## Environment Variables

```bash
# .env.example
PORT=8080
DATABASE_URL=postgres://user:pass@localhost/dbname
JWT_SECRET=changeme
```

Load with `godotenv` in development:

```go
import "github.com/joho/godotenv"

func init() {
    godotenv.Load() // loads .env if present, silently skips in prod
}
```
