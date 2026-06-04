FROM oven/bun AS base

# set for base and all layer that inherit from it
ENV NODE_ENV=production

FROM base AS deps
WORKDIR /app

COPY bun.lock package.json ./

RUN bun install --frozen-lockfile

FROM base AS production-deps
WORKDIR /app

COPY bun.lock package.json ./

RUN bun install --frozen-lockfile --production

# Build the app
FROM base AS build
WORKDIR /app

COPY --from=deps /app/node_modules /app/node_modules

COPY . .

RUN bun run build
RUN bun build --target=bun --production --minify server.ts --outfile /app/server.js

# Finally, build the production image with minimal footprint
FROM base AS runtime

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/server.js /app/server.js
COPY --from=build /app/build /app/build
COPY --from=build /app/public /app/public
COPY --from=production-deps /app/node_modules /app/node_modules

CMD ["bun", "server.js"]
