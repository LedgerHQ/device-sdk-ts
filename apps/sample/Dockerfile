# syntax=docker/dockerfile:1
# Build context: monorepo root
#   docker build -f apps/sample/Dockerfile -t dmk-sample .
# CI: built + pushed to infra-oci-web-apps-*-green/dmk-sample by the sample-* workflows.
# One pod runs both servers: Next.js (public, :3000) and the Flask API (127.0.0.1:5328).

# ── build ─────────────────────────────────────────────────────────────────────
FROM jfrog.ledgerlabs.net/ossproxy-oci-proxy-dockerio/node:24-slim AS builder
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.34.4 --activate

WORKDIR /repo
COPY . .
# Same install scope as Vercel (root vercel.json): skip the Electron devtools app.
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter "!@ledgerhq/device-management-kit-devtools"

# Public/build-time values are inlined into the browser bundle, so they are build args.
ARG NEXT_PUBLIC_GATING_TOKEN
ARG DMK_CONFIG_TRANSPORT
ENV NEXT_PUBLIC_GATING_TOKEN=$NEXT_PUBLIC_GATING_TOKEN \
    DMK_CONFIG_TRANSPORT=$DMK_CONFIG_TRANSPORT \
    BUILD_STANDALONE=true \
    API_URL=http://127.0.0.1:5328 \
    NEXT_TELEMETRY_DISABLED=1
RUN pnpm turbo run build --filter=@ledgerhq/device-management-kit-sample

# ── runtime ───────────────────────────────────────────────────────────────────
FROM jfrog.ledgerlabs.net/ossproxy-oci-proxy-dockerio/nikolaik/python-nodejs:python3.12-nodejs24-slim
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY apps/sample/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt gunicorn==23.0.0

# Standalone output keeps the monorepo layout: server.js lives under apps/sample/.
COPY --from=builder /repo/apps/sample/.next/standalone ./
COPY --from=builder /repo/apps/sample/.next/static ./apps/sample/.next/static
COPY --from=builder /repo/apps/sample/public ./apps/sample/public
COPY apps/sample/api ./py/api
COPY apps/sample/docker-entrypoint.sh ./docker-entrypoint.sh

# Built-in unprivileged user of the python-nodejs image (uid 1000).
USER pn
EXPOSE 3000
ENTRYPOINT ["bash", "./docker-entrypoint.sh"]
