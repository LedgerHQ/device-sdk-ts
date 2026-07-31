#!/bin/bash

ROOT_PATH=$(cd "$(dirname "$0")/.." && pwd)
GATING_DIR="$ROOT_PATH/ressources/gating"
EXTRA_ARGS=("$@")

shopt -s nullglob
FILES=("$GATING_DIR"/raw-*.json "$GATING_DIR"/typed-data-*.json)
shopt -u nullglob

if [[ ${#FILES[@]} -eq 0 ]]; then
  echo "No gating test files found in $GATING_DIR"
  exit 1
fi

EXIT_CODE=0
for TEST_FILE in "${FILES[@]}"; do
  BASENAME=$(basename "$TEST_FILE")
  case "$BASENAME" in
    raw-*.json)        CMD="raw-file" ;;
    typed-data-*.json) CMD="typed-data-file" ;;
    *)                 continue ;;
  esac

  echo "=== Running gating test: $BASENAME ($CMD) ==="
  # --skip-origin-token: simulate an unauthenticated client (no Ledger-Origin-Token header).
  # Test that the device falls back on the gating screen.
  (cd "$ROOT_PATH" && pnpm cli "$CMD" "$TEST_FILE" --blind-signing-enabled --skip-origin-token "${EXTRA_ARGS[@]}") || EXIT_CODE=$?
done

exit $EXIT_CODE
