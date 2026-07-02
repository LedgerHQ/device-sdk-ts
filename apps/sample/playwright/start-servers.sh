#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$SCRIPT_DIR/../../.."

# Each browser context (and each spec) provisions its own mock server session,
# so no shared session/token is created here.

# Fail fast instead of building. A production build is required (compile-on-demand
# under `next dev` makes the first request to each route take ~25s+, tripping the
# Playwright per-test timeout on slower/contended CI runners). The build is
# expected to already exist: CI restores apps/sample/.next from the build job's
# cache; locally, run `pnpm sample build` first.
if [ ! -d "$REPO_ROOT/apps/sample/.next" ]; then
  echo "Error: sample app is not built (apps/sample/.next is missing)." >&2
  echo "Run 'pnpm sample build' before starting the Playwright servers." >&2
  exit 1
fi

# Track only the processes we start ourselves (space-separated PID list), so
# servers that were already running (started manually or by CI) are left
# untouched on cleanup.
STARTED_PIDS=""

cleanup() {
  for pid in $STARTED_PIDS; do
    kill "$pid" 2>/dev/null || true
  done
}
trap cleanup EXIT

# Start a server only if its port is free; otherwise assume it is already running
# and reuse it (without registering it for cleanup).
#   maybe_start <name> <port> <command...>   (command runs from REPO_ROOT)
maybe_start() {
  name="$1"
  port="$2"
  shift 2
  if nc -z 127.0.0.1 "$port" 2>/dev/null; then
    echo "$name already running on port $port; reusing it."
    return
  fi
  echo "Starting $name..."
  (cd "$REPO_ROOT" && exec "$@") &
  STARTED_PIDS="$STARTED_PIDS $!"
  until nc -z 127.0.0.1 "$port" 2>/dev/null; do
    echo "Waiting for $name on port $port..."
    sleep 1
  done
  echo "$name is up!"
}

maybe_start "device mock server" 9752 pnpm --filter @ledgerhq/device-mock-server serve
maybe_start "sample app" 3000 pnpm sample start

# Stay in the foreground until Playwright tears the webServer down (which fires
# the cleanup trap). Block on the servers we started, or idle if both were reused.
if [ -n "$STARTED_PIDS" ]; then
  # shellcheck disable=SC2086 # intentional word-splitting of the PID list
  wait $STARTED_PIDS
else
  wait
fi
