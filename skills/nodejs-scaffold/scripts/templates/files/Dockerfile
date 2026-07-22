# syntax=docker/dockerfile:1
FROM node:22-alpine AS build
WORKDIR /src
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
# package.json's pnpm.onlyBuiltDependencies lets this frozen install build
# argon2 (native, musl-alpine prebuild) + esbuild non-interactively.
RUN pnpm install --frozen-lockfile
COPY . .
# Code-first OpenAPI: regenerate openapi.json from the route schemas so the
# image can never ship a stale committed copy. export-openapi.ts sets
# placeholder DATABASE_URL/JWT_SECRET itself — no DB needed (static route-schema
# introspection only), same fail-open pattern drizzle.config.ts uses.
RUN pnpm openapi:export
RUN pnpm build

FROM node:22-alpine
WORKDIR /app
RUN corepack enable
ENV NODE_ENV=production
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod
COPY --from=build /src/dist ./dist
COPY --from=build /src/drizzle ./drizzle
COPY --from=build /src/src/api/openapi.json ./src/api/openapi.json
EXPOSE 8080
# The server boots the API and, in the same process, an in-process Graphile
# Worker runner (outbox relay + idempotency cleanup). Run `pnpm db:migrate`
# once against the DB before/alongside first boot.
CMD ["node", "dist/server.js"]
