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

RUN bun run build
RUN bun build --target=bun --production --minify server.ts --outfile /app/server.js

# Finally, build the production image with minimal footprint
FROM base AS runtime

WORKDIR /app

COPY --from=build /app/server.js /app/server.js
COPY --from=build /app/build /app/build
COPY --from=build /app/public /app/public

CMD ["bun", "server.js"]
