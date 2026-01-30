# Trigger Snapshot Release

Trigger the snapshot release workflow to build and publish snapshot packages from the current branch.

## Requirements

- **GitHub CLI (`gh`)** — Must be installed and authenticated (`gh auth login`)
- **Git push access** — Write permissions to `LedgerHQ/device-sdk-ts`

## Prompt Variables

$TAG

> Optional: Snapshot version tag name (e.g., "my-feature"). Leave empty to use the branch name (with "/" replaced by "-").

## Instructions

Execute the following steps in order. Stop and report to the user if any step fails.

Throughout execution, collect any warnings (non-fatal issues) to include in the final output summary.

### 1. Get current branch

- Run: `git branch --show-current`
- If the output is empty, the repo is in detached HEAD state. Stop and inform the user: "Cannot trigger snapshot release: not on a branch (detached HEAD state)"
- Otherwise, store the branch name for later steps

### 2. Determine snapshot tag

- If `$TAG` is provided and non-empty:
  - Validate it contains only alphanumeric characters, hyphens (`-`), and underscores (`_`)
  - If invalid, stop and inform the user: "Invalid tag: only alphanumeric characters, hyphens, and underscores are allowed"
  - Use it as the snapshot tag
- Otherwise, derive the tag from the branch name by replacing all `/` characters with `-` (e.g., `feat/my-feature` becomes `feat-my-feature`)

### 3. Check for uncommitted changes

- Run: `git status --porcelain`
- If output is non-empty, **record a warning** (but continue): "Uncommitted changes won't be included in the snapshot"
  - Store this warning to include in the final output summary

### 4. Push branch to origin

- Run: `git push -u origin HEAD`
- **If push fails**:
  - If the error indicates the remote branch has diverged (e.g., "rejected" or "non-fast-forward"), inform the user: "Push failed: remote branch has diverged. Run `git pull --rebase` to update your local branch, or use `git push --force` if you're sure you want to overwrite the remote."
  - For other errors (e.g., permission denied), stop and report the error to the user

### 5. Trigger the snapshot workflow

- Run: `gh workflow run "[Release] Snapshot Release" -f ref=<branch> -f tag=<snapshot_tag>`
  - `<branch>` is the branch name from step 1
  - `<snapshot_tag>` is the tag determined in step 2
- **If the workflow trigger fails**, stop and report the error to the user

### 6. Get workflow run URL

- Wait 5 seconds for the workflow to be queued
- Fetch the most recent pending or in-progress run: `gh run list --workflow=snapshot_release.yml --limit 5 --json url,name,status,createdAt`
  - Note: Do not use `--branch` filter — `workflow_dispatch` runs are associated with the default branch, not the `ref` input
- Filter to runs with `status` of `"queued"`, `"in_progress"`, or `"pending"`
- Take the most recently created run (by `createdAt` timestamp)
- If the JSON output is an empty array `[]` or no matching run is found, retry up to 6 times with 5-second delays between attempts
- Parse the JSON output and extract the `url`, `name`, and `status` fields

### 7. Estimate build time

- Fetch recent completed runs: `gh run list --workflow=snapshot_release.yml --status completed --limit 20 --json conclusion,createdAt,updatedAt`
- Filter to successful runs only (`conclusion` = `"success"`)
- Take up to 5 most recent successful runs
- For each run, calculate duration in minutes: `(updatedAt - createdAt)` (both are ISO 8601 timestamps)
- Calculate the average duration, rounded to the nearest minute
- If no successful runs exist, note that build time cannot be estimated

## Output Format

After completing all steps, display the following summary:

---

**Snapshot release triggered**

- **Branch:** `<branch name>`
- **Tag:** `<snapshot tag>`
- **Workflow run:** [<run name> (<status>)](<run url>)
- **Expected build time:** ~<average> minutes (based on up to 5 recent successful builds)
  - If no successful builds exist: "Unknown (no previous successful builds)"
- **View all runs:** https://github.com/LedgerHQ/device-sdk-ts/actions/workflows/snapshot_release.yml

**Warnings:** (only include this section if there are warnings)

- List any warnings that occurred during execution, such as:
  - Uncommitted changes not included in the snapshot
  - Any other non-fatal issues encountered

---

## Workflow Reference

| Workflow Name                | Workflow File          | Description                            |
| ---------------------------- | ---------------------- | -------------------------------------- |
| `[Release] Snapshot Release` | `snapshot_release.yml` | Builds and publishes snapshot packages |

## Notes

- The snapshot workflow builds all packages from the specified branch and publishes them with the given tag
- Packages are published to JFrog with the snapshot tag (e.g., `@ledgerhq/device-management-kit@0.0.0-feat-my-feature.1`)
- The workflow runs on both public (for attestation) and private Ledger runners (for JFrog publishing)
- The branch must exist on `LedgerHQ/device-sdk-ts` (origin)
