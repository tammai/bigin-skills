# syntax=docker/dockerfile:1
FROM node:22-alpine AS build
WORKDIR /src
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:22-alpine
WORKDIR /app
RUN corepack enable
ENV NODE_ENV=production
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod
COPY --from=build /src/dist ./dist
COPY --from=build /src/openapi.yaml ./openapi.yaml
COPY --from=build /src/drizzle ./drizzle
EXPOSE 8080
CMD ["node", "dist/server.js"]
