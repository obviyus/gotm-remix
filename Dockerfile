FROM oven/bun AS base

# set for base and all layer that inherit from it
ENV NODE_ENV=production

FROM node:22.22.0-bookworm-slim AS node

FROM base AS build-base
COPY --from=node /usr/local/bin/node /usr/local/bin/node

FROM build-base AS deps
WORKDIR /app

COPY bun.lock package.json ./

RUN bun install --frozen-lockfile

FROM base AS production-deps
WORKDIR /app

COPY bun.lock package.json ./

RUN bun install --frozen-lockfile --production

# Build the app
FROM build-base AS build
WORKDIR /app

COPY --from=deps /app/node_modules /app/node_modules

COPY . .

RUN bun run build
RUN bun build --target=bun --packages=bundle --production build/server/index.js --outfile /app/build/server/index.js
RUN bun build --target=bun --production --minify server.ts --outfile /app/server.js

# Finally, build the production image with minimal footprint
FROM base AS runtime

WORKDIR /app

COPY --from=build /app/server.js /app/server.js
COPY --from=build /app/build /app/build
COPY --from=build /app/public /app/public
COPY --from=production-deps /app/node_modules/@libsql /app/node_modules/@libsql

CMD ["bun", "server.js"]
