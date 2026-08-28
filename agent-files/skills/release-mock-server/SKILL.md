---
name: release-mock-server
description: Release the device mock server — eat its changesets, bump the version, write the changelog, open the PR, then trigger the Docker image publish to JFrog. Activate when the user says "release mock server", "/release-mock-server", or asks to release/publish the device mock server Docker image.
---

# Release the mock server

Eat the changesets. Bump. Changelog. PR to develop. Once it's merged, poke the
workflow. It builds the Docker image and throws it at JFrog.

Private app, never on npm. Image tag = whatever `apps/device-mock-server/package.json`
says. Scripts live in `agent-files/scripts/release/mock-server/`, run with `pnpm exec zx`.

## Rules to remember

- Need `gh` installed and logged in. Need `pnpm`. Need push rights to
  `LedgerHQ/device-sdk-ts`.
- `gh` calls and `changelog.cjs` need `required_permissions: ["all"]`.
- Workflow reads the version AT THE REF IT BUILDS. So trigger on `develop` AFTER
  the PR merges. Early trigger = old tag = wrong image.
- Do steps in order. Any step breaks → stop, tell user, do not go on.
- Commit after every step that writes files.
- Collect warnings along the way. Dump them at the end.

## Writing a changeset for it

`pnpm changeset` won't list `@ledgerhq/device-mock-server` — it's `private` and
`privatePackages.version` is `false`. Write it by hand:

```bash
pnpm changeset add --empty
```

```markdown
---
"@ledgerhq/device-mock-server": minor
---

Add opt-in device onboarding simulation
```

One package per file. It sits in `.changeset/` until a mock server release eats
it — DMK releases skip it.

## The steps

```bash
# 1. Preflight. Fails → stop.
pnpm exec zx agent-files/scripts/release/preflight.cjs

# 2. What's pending? Show the user a table, wait for a yes.
pnpm exec zx agent-files/scripts/release/mock-server/discover.cjs

# 3. Branch off develop.
git checkout develop && git pull
git checkout -b release/mock-server-<to>

# 4. Bump. No lockfile update needed.
pnpm exec zx agent-files/scripts/release/mock-server/bump.cjs
git commit -am "🔖 (mock-server): Bump version to <to>"

# 5. Changelog. After step 4 — it reads the bumped version.
pnpm exec zx agent-files/scripts/release/mock-server/changelog.cjs
git add apps/device-mock-server/CHANGELOG.md
git commit -m "📝 (mock-server): Generate changelog"

# 6. Eat the changesets.
pnpm exec zx agent-files/scripts/release/mock-server/cleanup.cjs
git commit -am "🔥 (mock-server): Clean up consumed changesets"

# 7. Push. PR to develop, NOT main. Report the URL and STOP.
git push -u origin HEAD
gh pr create --base develop --title "🔖 (mock-server) [NO-ISSUE]: Release <to>" --body "..."

# 8. Only once it's merged: fire the workflow.
gh workflow run "release_mock_server.yml" -f ref=develop
```

Step 2 prints JSON: `from`, `to`, `bump`, `changesets[]`, `image`.

- Exits 1 with an `error` field = nothing pending. Ask if they want to release
  anyway (Dockerfile / CI / deps change). If yes, add `--bump patch|minor|major`
  to steps 2 and 4, and skip step 5 — no changeset, nothing to write.
- `mixedChangesets` non-empty = that changeset also covers another package.
  Warn: step 6 strips only the mock server line and leaves the file behind.

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

- Version:  <old> → <new> (<bump>)
- PR:       <pr url>
- Image:    jfrog.ledgerlabs.net/bcs-oci-prod-green/device-mock-server:<new>
- Run:      [<run name> (<status>)](<run url>)
- ETA:      ~<avg> min (last 5 good builds)   # or: Unknown (no good builds yet)
- All runs: https://github.com/LedgerHQ/device-sdk-ts/actions/workflows/release_mock_server.yml
```

Add a **Warnings** list only if you collected any.

## Things that bite

- Image tag is exactly the package version. No `v` prefix, no `latest`.
- Build context is the WHOLE monorepo root. The Dockerfile's pnpm workspace
  install needs it.
- Runs on the `ledgerhq-device-sdk` private runner. JFrog is invisible from
  public runners.
- `openapi.yaml` has its own `info.version`. That's the HTTP contract, not the
  package version. Leave it alone unless the contract changed.
