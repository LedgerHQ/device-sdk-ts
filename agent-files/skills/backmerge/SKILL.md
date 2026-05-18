---
name: backmerge
description: Backmerge the release branch into develop after the release PR has been merged to main. Activate when the user says "backmerge", "/backmerge", or asks to backmerge after a release PR merges.
---

# Backmerge Release

Backmerge the release branch into `develop` after the release PR has been merged to `main`.

## Permission prompts

The following commands need network access or post-install scripts, so they will trigger a permission prompt (Claude Code) or must be run with `required_permissions: ["all"]` (Cursor):

- `pnpm install` (Step 5 — post-install scripts, native deps)
- `git push -u origin chore/backmerge` + `gh pr create ...` (Step 7 — network + `gh`)

All other scripts (`revert-private`, `unpin-deps`) run fine inside the sandbox.

## Backmerge flow (step by step)

All revert/unpin scripts live in `agent-files/scripts/release/` and are run with `pnpm exec zx`.

### Step 1 -- Checkout main

```bash
git checkout main && git pull
```

- Ensure you are on the latest `main` with the merged release PR.

### Step 2 -- Create backmerge branch

```bash
git checkout -b chore/backmerge
```

### Step 3 -- Revert private flags

```bash
pnpm exec zx agent-files/scripts/release/revert-private.cjs
```

- Resets `private` flags on all packages to their pre-release state.
- Verify that all relevant packages have `private: false` in their `package.json` files.

### Step 4 -- Restore workspace deps

```bash
pnpm exec zx agent-files/scripts/release/unpin-deps.cjs
```

- Replaces pinned version ranges (e.g., `^1.2.3`) back to `workspace:^` for internal dependencies.

### Step 5 -- Update lockfile

```bash
pnpm install
```

- Regenerates the lockfile to match the restored `workspace:^` deps.

### Step 6 -- Commit

```bash
git add .
git commit -m "🔧 (release): Reset private packages after release"
```

### Step 7 -- Create backmerge PR

```bash
git push -u origin chore/backmerge
gh pr create -B develop --title "🔀 (release) [NO-ISSUE]: Backmerge release into develop" -F .github/pull_request_backmerge_template.md
```

- Report the PR URL to the user.

## Handling conflicts

If there are conflicts between `main` and `develop`:

- **Never rebase.** Merge `develop` into the backmerge branch to resolve conflicts.
- Resolve all merge conflicts manually.
- Test the resolution locally before pushing.

## Error handling

- If any script fails, read its stderr output and fix the issue before retrying.
- If `revert-private.cjs` or `unpin-deps.cjs` fails, ensure the release PR was actually merged to `main` first.
- If `gh pr create` fails, ensure `gh` CLI is authenticated (`gh auth status`) and the branch is pushed.
- Never force-push or amend commits that have been pushed to a shared branch.
