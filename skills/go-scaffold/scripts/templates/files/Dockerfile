# syntax=docker/dockerfile:1
# Floating major tag, not pinned — `go mod tidy` bumps go.mod's go directive as
# dependencies require; a pinned builder tag eventually goes older than that and
# fails the build.
FROM golang:1-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o /out/server ./cmd/server

FROM gcr.io/distroless/static-debian12:nonroot
# distroless nonroot's default WORKDIR is /home/nonroot, not / — without this,
# the relative os.ReadFile("openapi.yaml") in cmd/server fails and the process
# exits at boot.
WORKDIR /
COPY --from=build /out/server /server
COPY openapi.yaml /openapi.yaml
EXPOSE 8090
ENTRYPOINT ["/server"]
