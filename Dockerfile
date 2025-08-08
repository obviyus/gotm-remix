# syntax=docker/dockerfile:1.7
FROM oven/bun AS base

# set for base and all layer that inherit from it
ENV NODE_ENV=production

FROM base AS deps
WORKDIR /app

COPY bun.lock package.json ./

RUN bun install

# Build the app
FROM base AS build
WORKDIR /app

COPY --from=deps /app/node_modules /app/node_modules

COPY . .

# Allow build-time DB access for prerender via BuildKit secrets
RUN --mount=type=secret,id=TURSO_DATABASE_URL \
    --mount=type=secret,id=TURSO_AUTH_TOKEN \
    TURSO_DATABASE_URL="$(cat /run/secrets/TURSO_DATABASE_URL 2>/dev/null || echo)" \
    TURSO_AUTH_TOKEN="$(cat /run/secrets/TURSO_AUTH_TOKEN 2>/dev/null || echo)" \
    bun run build

# Finally, build the production image with minimal footprint
FROM base

WORKDIR /app

COPY --from=deps /app/node_modules /app/node_modules
COPY --from=build /app/build /app/build
COPY --from=build /app/public /app/public
COPY . .

CMD ["bun", "run", "start"]