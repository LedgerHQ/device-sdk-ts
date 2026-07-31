---
name: release-mock-server
description: Bump the mock server version in package.json, commit, push, and trigger the Docker image publish workflow to JFrog. Activate when the user says "release mock server", "/release-mock-server", or asks to release/publish the device mock server Docker image.
---

# Release mock server

Bump version. Commit. Push. Poke the workflow. It builds the Docker image and
throws it at JFrog.

Version lives in `apps/device-mock-server/package.json`. Workflow lives in
`.github/workflows/release_mock_server.yml`.

## Rules to remember

- Need `gh` installed and logged in. Need `pnpm`. Need push rights to
  `LedgerHQ/device-sdk-ts`.
- `gh` calls need `required_permissions: ["all"]`.
- Workflow reads version from package.json AT THE PUSHED REF. So push the bump
  BEFORE you trigger. No push = old version = wrong tag.
- Do steps in order. Any step breaks → stop, tell user, do not go on.
- Collect warnings along the way. Dump them at the end.
- `$BUMP` = `patch` | `minor` | `major`. No `$BUMP` = `patch`.

## The steps

```bash
# 1. Bump type. $BUMP or patch. Not one of patch/minor/major → stop.

# 2. On a branch? Empty = detached HEAD → stop.
git branch --show-current

# 3. Clean tree? Non-empty = dirty → stop, user commits/stashes first.
git status --porcelain

# 4. Old version (remember it for the summary).
jq -r '.version' apps/device-mock-server/package.json

# 5. Bump it. Remember new version.
(cd apps/device-mock-server && pnpm version "$BUMP" --no-git-tag-version --no-commit-hooks)
jq -r '.version' apps/device-mock-server/package.json

# 6. Commit just the package.json. Gitmoji style.
git add apps/device-mock-server/package.json
git commit -m "🔖 (mock-server): Bump version to <new_version>"

# 7. Push. Rejected/non-fast-forward → tell user to `git pull --rebase`
#    (or `git push --force` if they mean it). Other error → stop, report.
git push -u origin HEAD

# 8. Fire the workflow at the branch.
gh workflow run "release_mock_server.yml" -f ref=<branch>
```

## Find the run

Wait 5s. Then hunt the fresh run:

```bash
gh run list --workflow=release_mock_server.yml --limit 5 --json url,name,status,createdAt
```

- No `--branch` filter. `workflow_dispatch` runs hang off the default branch,
  not your `ref`.
- Keep runs that are `queued`, `in_progress`, or `pending`. Newest `createdAt`
  wins.
- Empty list? Retry up to 6 times, 5s apart.

## Guess the build time

```bash
gh run list --workflow=release_mock_server.yml --status completed --limit 20 --json conclusion,createdAt,updatedAt
```

- Keep `conclusion == success`. Take up to 5 newest.
- Duration = `updatedAt - createdAt` in minutes. Average them, round.
- No successes = can't guess.

## Tell the user

```
Mock server Docker image release triggered

- Branch:   <branch>
- Version:  <old> → <new> (<bump>)
- Image:    jfrog.ledgerlabs.net/bcs-oci-prod-green/device-mock-server:<new>
- Run:      [<run name> (<status>)](<run url>)
- ETA:      ~<avg> min (last 5 good builds)   # or: Unknown (no good builds yet)
- All runs: https://github.com/LedgerHQ/device-sdk-ts/actions/workflows/release_mock_server.yml
```

Add a **Warnings** list only if you collected any.

## Things that bite

- Image tag = `jfrog.ledgerlabs.net/bcs-oci-prod-green/device-mock-server:<version>`.
- Build context is the WHOLE monorepo root. The Dockerfile's pnpm workspace
  install needs it.
- Runs on the `ledgerhq-device-sdk` private runner. JFrog is invisible from
  public runners.
