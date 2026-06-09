#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# NOTE: the device mock server is expected to be started manually beforehand on
# http://127.0.0.1:8080, e.g. `pnpm --filter @ledgerhq/device-mock-server serve`.
# Each browser context (and each spec) provisions its own mock server session, so
# no shared session/token is created here.

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
