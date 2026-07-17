# syntax=docker/dockerfile:1
# Build context: monorepo root
# Standalone:  docker build -f apps/device-mock-server/Dockerfile -t device-mock-server .
# Compose:     docker compose -f apps/device-mock-server/docker-compose.yml up

# ── install ───────────────────────────────────────────────────────────────────
FROM node:24-alpine AS install
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
# bash is required by the zx-based ldmk-tool used to build workspace deps
RUN apk add --no-cache bash \
 && corepack enable && corepack prepare pnpm@10.34.4 --activate

WORKDIR /repo
COPY . .
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ── bundle ────────────────────────────────────────────────────────────────────
FROM install AS builder
# Build workspace deps so their lib/ output is available for esbuild to bundle
RUN pnpm --filter @ledgerhq/device-mockserver-client... build

# Bundle the entire server — including all workspace deps — into one file.
# bufferutil and utf-8-validate are optional native perf add-ons for ws;
# ws works without them, so they stay external and are omitted from the image.
RUN node_modules/.bin/esbuild \
      apps/device-mock-server/src/main.ts \
      --bundle \
      --platform=node \
      --target=node24 \
      --outfile=/bundle/server.js \
      --format=cjs \
      --tsconfig=apps/device-mock-server/tsconfig.json \
      --external:bufferutil \
      --external:utf-8-validate

# ── runner ────────────────────────────────────────────────────────────────────
FROM node:24-alpine
WORKDIR /app
# Run as the built-in unprivileged `node` user (uid 1000) instead of root
COPY --chown=node:node --from=builder /bundle/server.js .
USER node
EXPOSE 9752
CMD ["node", "server.js"]
