#!/bin/bash
set -e

is_running_on_github_actions() {
    [ -n "$CI" ] && [ -n "$GITHUB_ACTIONS" ]
}

run_danger_on_github_actions() {
    echo "Script is running within GitHub Actions workflow."
    pnpm danger ci --dangerfile danger/dangerfile.ts --failOnErrors
}

run_danger_on_local() {
    echo "Script is running locally."
    pnpm danger pr --dangerfile danger/dangerfile.ts https://github.com/LedgerHQ/device-sdk-ts/pull/${1}
}

if is_running_on_github_actions; then
    run_danger_on_github_actions
else
    if [ -z "$1" ]; then
        echo "Argument PR number is missing"
        exit 1
    fi
    run_danger_on_local "$1"
fi

