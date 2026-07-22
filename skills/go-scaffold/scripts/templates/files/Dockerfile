# syntax=docker/dockerfile:1
# Floating major tag, not pinned — `go mod tidy` bumps go.mod's go directive
# as dependencies require; a pinned builder tag would eventually be older
# than that and fail the build.
FROM golang:1-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o /out/server ./cmd/server

FROM gcr.io/distroless/static-debian12:nonroot
# distroless nonroot's default WORKDIR is /home/nonroot, not / — without this,
# main.go's relative os.ReadFile("api/openapi.yaml") 404s /docs and /openapi.yaml.
WORKDIR /
COPY --from=build /out/server /server
COPY api/openapi.yaml /api/openapi.yaml
EXPOSE 8080
ENTRYPOINT ["/server"]
