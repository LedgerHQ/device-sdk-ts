#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$SCRIPT_DIR/../../.."

if [ ! -d "$REPO_ROOT/apps/sample/.next" ]; then
  echo "Error: sample app is not built (apps/sample/.next is missing)." >&2
  echo "Run 'pnpm sample build' before starting the Playwright servers." >&2
  exit 1
fi

STARTED_PIDS=""

cleanup() {
  for pid in $STARTED_PIDS; do
    kill "$pid" 2>/dev/null || true
  done
}
trap cleanup EXIT

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

maybe_start "sample app" 3000 pnpm sample start

if [ -n "$STARTED_PIDS" ]; then
  # shellcheck disable=SC2086
  wait $STARTED_PIDS
else
  wait
fi
