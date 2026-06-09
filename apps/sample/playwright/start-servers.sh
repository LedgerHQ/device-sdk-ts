#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TOKEN_FILE="$SCRIPT_DIR/.mock-session-token"
MOCK_SERVER_URL="http://127.0.0.1:8080"

rm -f "$TOKEN_FILE"

# NOTE: the device mock server is expected to be started manually beforehand on
# http://127.0.0.1:8080, e.g. `pnpm --filter @ledgerhq/device-mock-server serve`.

# Create one session up front and share its bearer token with both the sample
# app and the Playwright specs, so they all operate on the same
# authenticated mock server session.
echo "Creating mock server session..."
TOKEN=$(curl -s -X POST "$MOCK_SERVER_URL/auth" | sed -E 's/.*"token":"([^"]+)".*/\1/')
if [ -z "$TOKEN" ]; then
  echo "Failed to reach the mock server at $MOCK_SERVER_URL." >&2
  echo "Start it first: pnpm --filter @ledgerhq/device-mock-server serve" >&2
  exit 1
fi
echo "$TOKEN" > "$TOKEN_FILE"
export NEXT_PUBLIC_MOCK_SERVER_SESSION_TOKEN="$TOKEN"
echo "Mock server session token shared with the sample app."

echo "Starting sample app..."
(cd "$SCRIPT_DIR/../../.." && pnpm --filter @ledgerhq/device-management-kit-sample dev:default-mock) &
SAMPLE_APP_PID=$!

while ! nc -z localhost 3000; do
  echo "Waiting for sample app to start..."
  sleep 1
done
echo "Sample app is up!"

# trap to kill the background process on script exit
trap "kill $SAMPLE_APP_PID" EXIT

wait $SAMPLE_APP_PID
