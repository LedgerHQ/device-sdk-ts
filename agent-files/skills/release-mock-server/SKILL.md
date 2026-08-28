---
name: release-mock-server
description: Release the device mock server — consume its changesets, bump the version, generate the changelog, open the release PR, then trigger the Docker image publish to JFrog. Activate when the user says "release mock server", "/release-mock-server", or asks to release/publish the device mock server Docker image.
---

# Release the mock server

The mock server is a **private** workspace app (`apps/device-mock-server`). It is
never published to npm — the deliverable is a Docker image on JFrog, tagged with
the version in its `package.json`.

Same shape as the `release` skill, minus everything npm-specific: no release
scope, no dependency pinning, no lockfile update. Scripts live in
`agent-files/scripts/release/mock-server/` and run with `pnpm exec zx`.

## Adding a changeset for the mock server

`pnpm changeset` will **not** offer `@ledgerhq/device-mock-server` in its
interactive picker — the package is `private: true` and `.changeset/config.json`
sets `privatePackages.version: false`. So write the changeset by hand:

```bash
pnpm changeset add --empty
```

Then fill the new `.changeset/*.md` file:

```markdown
---
"@ledgerhq/device-mock-server": minor
---

Add opt-in device onboarding simulation
```

One package per changeset (the danger bot enforces it). These files sit in
`.changeset/` until a mock server release consumes them — the DMK release
scripts skip them, because they only look at public, non-`apps/` packages.

## Permission prompts

These need network, the GitHub CLI, or both, so they trigger a permission prompt
(Claude Code) or need `required_permissions: ["all"]` (Cursor):

- `preflight.cjs` (Step 1 — `gh auth status`)
- `mock-server/changelog.cjs` (Step 5 — GitHub API via `gh`)
- `gh pr create` (Step 7) and `gh workflow run` / `gh run list` (Step 8)

`discover`, `bump` and `cleanup` run fine inside the sandbox.

## Release flow

Commit after every step that touches files — it keeps the release PR readable.

### Step 1 — Preflight

```bash
pnpm exec zx agent-files/scripts/release/preflight.cjs
```

Must pass before anything else. Same script as the DMK release.

### Step 2 — Discover & confirm

```bash
pnpm exec zx agent-files/scripts/release/mock-server/discover.cjs
```

Prints JSON: `from`, `to`, `bump`, `bumpSource`, `changesets[]`, `image`.
Show the user a table and **wait for confirmation**:

```
| Package | From | To | Bump | Changesets |
|---------|------|----|------|------------|
| @ledgerhq/device-mock-server | 0.1.1 | 0.2.0 | minor | bold-tigers-run, easy-rings-bake |
```

- **No pending changeset** → the script exits 1 with an `error` field. Ask the
  user whether to release anyway (an infra-only change: Dockerfile, CI, deps).
  If yes, pass `--bump patch|minor|major` to `discover.cjs` **and** `bump.cjs`.
  Step 5 then has nothing to write — say so, and put the summary in the PR body.
- **`mixedChangesets` non-empty** → a changeset covers the mock server *and*
  another package. Warn the user: Step 6 will strip only the mock server line
  and leave the file for the other package's release.

### Step 3 — Create the release branch

```bash
git checkout develop && git pull
git checkout -b release/mock-server-<to>
```

### Step 4 — Bump the version

```bash
pnpm exec zx agent-files/scripts/release/mock-server/bump.cjs
```

Writes the new version to `apps/device-mock-server/package.json`. No lockfile
update is needed — a workspace app's own version is not recorded in
`pnpm-lock.yaml`.

```bash
git add apps/device-mock-server/package.json
git commit -m "🔖 (mock-server): Bump version to <to>"
```

### Step 5 — Generate the changelog

```bash
pnpm exec zx agent-files/scripts/release/mock-server/changelog.cjs
```

Prepends a `## <version>` section to `apps/device-mock-server/CHANGELOG.md`,
with the PR link, commit link and author for each changeset — same format the
DMK release produces. Creates the file on the first release.

Run it **after** Step 4: it reads the already-bumped version, and refuses to
write a section that already exists.

```bash
git add apps/device-mock-server/CHANGELOG.md
git commit -m "📝 (mock-server): Generate changelog"
```

### Step 6 — Clean up consumed changesets

```bash
pnpm exec zx agent-files/scripts/release/mock-server/cleanup.cjs
```

Deletes the changesets this release consumed. A changeset that also covers
another package is edited instead of deleted, and reported under `stripped`.

```bash
git add .changeset
git commit -m "🔥 (mock-server): Clean up consumed changesets"
```

### Step 7 — Push and open the PR

```bash
git push -u origin HEAD
gh pr create --base develop --title "🔖 (mock-server): Release <to>" --body "..."
```

- Target is **develop**, not `main` — the mock server is not part of the npm
  release train.
- Body: version, bump type, and the changelog section from Step 5.
- Rejected push / non-fast-forward → tell the user to `git pull --rebase`. Any
  other error → stop and report.
- Report the PR URL and stop. **Do not trigger the Docker build yet.**

### Step 8 — After the PR merges: publish the image

The workflow reads the version from `package.json` **at the ref it builds**, so
it must run on `develop` after the merge, or the image gets the old tag.

```bash
gh workflow run "release_mock_server.yml" -f ref=develop
```

Wait 5s, then find the fresh run:

```bash
gh run list --workflow=release_mock_server.yml --limit 5 --json url,name,status,createdAt
```

- No `--branch` filter: `workflow_dispatch` runs hang off the default branch,
  not the `ref` input.
- Keep runs that are `queued`, `in_progress` or `pending`; newest `createdAt`
  wins. Empty list → retry up to 6 times, 5s apart.

Estimate the build time from recent successes:

```bash
gh run list --workflow=release_mock_server.yml --status completed --limit 20 --json conclusion,createdAt,updatedAt
```

Keep `conclusion == success`, take up to 5 newest, average `updatedAt - createdAt`
in minutes, round. No successes → can't guess.

## Report to the user

```
Mock server Docker image release triggered

- Version:  <from> → <to> (<bump>)
- PR:       <pr url>
- Image:    jfrog.ledgerlabs.net/bcs-oci-prod-green/device-mock-server:<to>
- Run:      [<run name> (<status>)](<run url>)
- ETA:      ~<avg> min (last 5 good builds)   # or: Unknown (no good builds yet)
- All runs: https://github.com/LedgerHQ/device-sdk-ts/actions/workflows/release_mock_server.yml
```

Add a **Warnings** list only if you collected any along the way.

## Things that bite

- Any step fails → stop, tell the user, do not carry on.
- Needs `gh` installed and authenticated, `pnpm`, and push rights to
  `LedgerHQ/device-sdk-ts`.
- Image tag is exactly the `package.json` version — no `v` prefix, no `latest`.
- The Docker build context is the **whole monorepo root**; the Dockerfile's pnpm
  workspace install needs it.
- Runs on the `ledgerhq-device-sdk` private runner — JFrog is invisible from
  public runners.
- `openapi.yaml` / `openapi/definition.ts` carry their own `info.version` for the
  API contract. It is **not** the package version and this flow does not touch
  it. Bump it only when the HTTP contract itself changes.
