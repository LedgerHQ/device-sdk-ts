# Trigger Snapshot Release

Trigger the snapshot release workflow on the current repository.

## Requirements

- **GitHub CLI (`gh`)** — Must be installed and authenticated (`gh auth login`)
- **Git push access** — Write permissions to `LedgerHQ/device-sdk-ts`

## Prompt Variables

$TAG

> Optional: Snapshot version tag name (e.g., "my-feature"). Leave empty to use the branch name (with "/" replaced by "-").

## Instructions

### Step 1: Validate and get current branch

```bash
# Get current branch name
BRANCH=$(git branch --show-current)
echo "Current branch: $BRANCH"

# Use TAG if provided, otherwise use sanitized branch name
# (replace "/" with "-" to make it valid for npm package versions)
if [ -z "$TAG" ]; then
  SNAPSHOT_TAG="${BRANCH//\//-}"
  echo "Using sanitized branch name as tag: $SNAPSHOT_TAG"
else
  SNAPSHOT_TAG="$TAG"
  echo "Using provided tag: $SNAPSHOT_TAG"
fi

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
  echo "⚠️  Warning: You have uncommitted changes that won't be included in the snapshot."
fi
```

### Step 2: Push branch to origin

```bash
# Ensure branch is pushed to origin
if ! git push origin "$BRANCH"; then
  echo "❌ Failed to push branch to origin"
  exit 1
fi
echo "✅ Branch pushed to origin"
```

### Step 3: Trigger the snapshot workflow

```bash
if ! gh workflow run "[Release] Snapshot Release" \
  -f ref="$BRANCH" \
  -f tag="$SNAPSHOT_TAG"; then
  echo "❌ Failed to trigger snapshot release workflow"
  exit 1
fi
echo "✅ Workflow triggered"
```

### Step 4: Wait and fetch the triggered run URL

Wait for the workflow to be queued, then fetch the most recent run:

```bash
# Retry configuration
MAX_RETRIES=6
RETRY_DELAY=5

fetch_run_url() {
  local workflow_file="snapshot_release.yml"
  local retries=0

  while [ $retries -lt $MAX_RETRIES ]; do
    result=$(gh run list \
      --workflow="$workflow_file" \
      --limit 1 \
      --json url,name,status \
      --jq '.[0] | "[\(.name) (\(.status))](\(.url))"')

    if [ -n "$result" ] && [ "$result" != "null" ]; then
      echo "$result"
      return 0
    fi

    retries=$((retries + 1))
    sleep $RETRY_DELAY
  done

  echo "⚠️  Could not find run for $workflow_file (check manually)"
  return 1
}

RUN_RESULT=$(fetch_run_url)
```

### Step 5: Calculate average build time from recent successful runs

```bash
get_average_build_time() {
  local workflow_file="snapshot_release.yml"

  # Fetch 5 most recent successful runs with their duration
  durations=$(gh run list \
    --workflow="$workflow_file" \
    --status completed \
    --limit 20 \
    --json conclusion,createdAt,updatedAt \
    --jq '[.[] | select(.conclusion == "success")] | .[0:5] | [.[] | (((.updatedAt | fromdateiso8601) - (.createdAt | fromdateiso8601)) / 60)] | if length > 0 then (add / length | floor) else null end')

  if [ -n "$durations" ] && [ "$durations" != "null" ]; then
    echo "~${durations} minutes (based on last 5 successful builds)"
  else
    echo "No recent successful builds to estimate duration"
  fi
}

AVG_TIME=$(get_average_build_time)
```

### Output Format

After triggering the build, display a summary using markdown for clickable links:

```
✅ **Snapshot release triggered**

📦 **Branch:** `$BRANCH`
🏷️  **Tag:** `$SNAPSHOT_TAG`

🔗 **Workflow run:**

- $RUN_RESULT

⏱️  **Expected build time:** $AVG_TIME

You can also view all runs at: https://github.com/LedgerHQ/device-sdk-ts/actions/workflows/snapshot_release.yml
```

## Workflow Reference

| Workflow Name                | Workflow File          | Description                            |
| ---------------------------- | ---------------------- | -------------------------------------- |
| `[Release] Snapshot Release` | `snapshot_release.yml` | Builds and publishes snapshot packages |

## Notes

- The snapshot workflow builds all packages from the specified branch and publishes them with the given tag
- When using branch name as tag, "/" is replaced with "-" (e.g., `feat/my-feature` becomes `feat-my-feature`)
- Packages are published to JFrog with the snapshot tag (e.g., `@ledgerhq/device-management-kit@0.0.0-feat-my-feature.1`)
- The workflow runs on both public (for attestation) and private Ledger runners (for JFrog publishing)
- The branch must exist on `LedgerHQ/device-sdk-ts` (origin)
- Expected build times are calculated dynamically from the 5 most recent successful runs
