# Release Packages

Release one or more packages from this monorepo using the scripts in `.cursor/scripts/release/`.

## When to use

Activate this skill when the user says "release", "/release", or asks to release specific packages (e.g., "/release dmk signer-eth").

## Package aliases

Use these short names in the `--packages` flag. The user may use either aliases or full names.

| Alias                   | Full package name                                              |
| ----------------------- | -------------------------------------------------------------- |
| `dmk`                   | `@ledgerhq/device-management-kit`                              |
| `signer-eth`            | `@ledgerhq/device-signer-kit-ethereum`                         |
| `signer-btc`            | `@ledgerhq/device-signer-kit-bitcoin`                          |
| `signer-sol`            | `@ledgerhq/device-signer-kit-solana`                           |
| `signer-aleo`           | `@ledgerhq/device-signer-kit-aleo`                             |
| `signer-cosmos`         | `@ledgerhq/device-signer-kit-cosmos`                           |
| `signer-hyperliquid`    | `@ledgerhq/device-signer-kit-hyperliquid`                      |
| `signer-concordium`     | `@ledgerhq/device-signer-kit-concordium`                       |
| `signer-zcash`          | `@ledgerhq/device-signer-kit-zcash`                            |
| `signer-utils`          | `@ledgerhq/signer-utils`                                       |
| `context-module`        | `@ledgerhq/context-module`                                     |
| `transport-web-hid`     | `@ledgerhq/device-transport-kit-web-hid`                       |
| `transport-web-ble`     | `@ledgerhq/device-transport-kit-web-ble`                       |
| `transport-rn-ble`      | `@ledgerhq/device-transport-kit-react-native-ble`              |
| `transport-rn-hid`      | `@ledgerhq/device-transport-kit-react-native-hid`              |
| `transport-node-hid`    | `@ledgerhq/device-transport-kit-node-hid`                      |
| `transport-mockserver`  | `@ledgerhq/device-transport-kit-mockserver`                    |
| `transport-speculos`    | `@ledgerhq/device-transport-kit-speculos`                      |
| `mockserver-client`     | `@ledgerhq/device-mockserver-client`                           |
| `speculos-controller`   | `@ledgerhq/speculos-device-controller`                         |
| `keyring-protocol`      | `@ledgerhq/device-trusted-app-kit-ledger-keyring-protocol`     |
| `ledger-wallet`         | `@ledgerhq/dmk-ledger-wallet`                                  |
| `devtools-core`         | `@ledgerhq/device-management-kit-devtools-core`                |
| `devtools-rozenite`     | `@ledgerhq/device-management-kit-devtools-rozenite`            |
| `devtools-ui`           | `@ledgerhq/device-management-kit-devtools-ui`                  |
| `devtools-ws-common`    | `@ledgerhq/device-management-kit-devtools-websocket-common`    |
| `devtools-ws-connector` | `@ledgerhq/device-management-kit-devtools-websocket-connector` |
| `devtools-ws-server`    | `@ledgerhq/device-management-kit-devtools-websocket-server`    |

## Release flow (step by step)

All scripts live in `.cursor/scripts/release/` and are run with `pnpm exec zx`.
Replace `<PKGS>` with a comma-separated list of aliases (e.g., `dmk,signer-eth`).

**Important:** Commit after every step that modifies files. This keeps the release branch bisectable and easy to review.

### Step 1 -- Preflight

```bash
pnpm exec zx .cursor/scripts/release/preflight.cjs
```

- Run with `required_permissions: ["all"]` since `gh auth status` needs network access.
- If any check fails, fix the issue before proceeding.
- This step **MUST** pass before running any other release step.

### Step 2 -- Discover & confirm

```bash
pnpm exec zx .cursor/scripts/release/discover.cjs
```

- Parse the JSON output. The script returns `{ releasable, warnings }`.
- `releasable` is an array of packages that have changesets, each with `name`, `displayName`, `version`, `bump` (highest bump: major > minor > patch), and `changesets` (list of changeset names).
- Present a **table of all releasable packages** to the user:

```
| Package | Current version | Bump | Changesets |
|---------|----------------|------|------------|
| @ledgerhq/device-signer-kit-ethereum | 1.12.0 | minor | common-bats-fail, plenty-parents-hope |
| @ledgerhq/signer-utils | 1.1.3 | patch | heavy-apple-write |
```

- If `warnings` is non-empty, display each warning prominently **below the table**. These warnings flag internal dependencies of a releasable package whose dependency is not itself being released. Example:

> **WARNING:** Signer ETH (@ledgerhq/device-signer-kit-ethereum) depends on Signer Utils (@ledgerhq/signer-utils) as dependency, but Signer Utils has no changesets and will not be released.

- If a requested package has no changesets (not in `releasable`), warn the user explicitly (Bump = "none").
- **Wait for the user to confirm** before proceeding. Do NOT continue until the user explicitly approves.

### Step 3 -- Create release branch

```bash
git checkout develop && git pull
git checkout -b release
```

### Step 4 -- Set private flags

```bash
pnpm exec zx .cursor/scripts/release/set-private.cjs --packages <PKGS>
```

- Sets `private:false` on target packages, `private:true` on everything else.
- Auto-includes dependents of major-bumped packages (creates a patch changeset for them).
- Review the JSON summary to confirm the right packages are public.

**Commit:**

```bash
git add .
git commit -m "🔧 (release): Set private flags for <packages>"
```

### Step 5 -- Pin workspace deps

```bash
pnpm exec zx .cursor/scripts/release/pin-deps.cjs --packages <PKGS>
```

- Replaces `workspace:^` with `^<version>` for deps pointing to non-released internal packages.
- Review the pinned list; deps between released packages stay as `workspace:^`.

**Commit:**

```bash
git add .
git commit -m "🔧 (release): Pin workspace dependencies"
```

### Step 6 -- Bump versions

```bash
pnpm exec zx .cursor/scripts/release/bump.cjs
```

- Reads changesets and applies semver bumps to `package.json`.
- Propagates patch bumps to released packages that depend on bumped packages.
- Review the bumps summary. Verify versions look correct.

**Commit:**

```bash
git add .
git commit -m "🔖 (release): Bump versions"
```

### Step 7 -- Generate changelogs

```bash
pnpm exec zx .cursor/scripts/release/changelog.cjs
```

- Run with `required_permissions: ["all"]` since the script calls the GitHub API (via `gh`) to enrich changesets with PR/commit metadata.
- Prepends new entries to each bumped package's `CHANGELOG.md`.
- Review a couple of changelogs to confirm formatting.

**Commit:**

```bash
git add .
git commit -m "📝 (release): Generate changelogs"
```

### Step 8 -- Clean up changesets

```bash
pnpm exec zx .cursor/scripts/release/cleanup.cjs
```

- Deletes `.changeset/*.md` files consumed by the release.

**Commit:**

```bash
git add .
git commit -m "🔥 (release): Clean up consumed changesets"
```

### Step 9 -- Update lockfile

```bash
pnpm install --no-frozen-lockfile
```

- The `--no-frozen-lockfile` flag is required because Step 5 pinned workspace deps (replacing `workspace:^` with concrete versions), which makes the existing lockfile out of date.

**Commit:**

```bash
git add .
git commit -m "🔧 (release): Update lockfile"
```

### Step 10 -- Update getting-started.mdx

Update the version tables in `apps/docs/pages/docs/getting-started.mdx` to reflect the new versions of all released packages.

- Read the file and locate the library tables (DMK, Signers & Trusted App Kit, Transports, DevTools).
- For each released (public) package, find its row in the table and replace the old version number with the new bumped version from Step 6.
- Only update rows for packages that were actually released.

**Commit:**

```bash
git add .
git commit -m "📝 (release): Update getting-started versions"
```

### Step 11 -- Create release PR

```bash
pnpm exec zx .cursor/scripts/release/create-pr.cjs
```

- Opens a PR targeting `main` with a version summary body.
- Report the PR URL to the user.

### Step 12 -- Verify documentation and README

Perform a documentation health check. This step does not block the release but surfaces issues for the user.

- **`apps/docs/pages/docs/getting-started.mdx`**: Cross-check that every released package now shows its new version in the tables. Report any mismatches.
- **`README.md`**: Check that every released package appears in the package inventory tables (around lines 88-153). If a package is missing, warn the user.
- **Migration guides**: For any package with a **major** or **minor** bump, check whether a migration guide exists under `apps/docs/pages/docs/integration/migrations/`. If none is found, remind the user that a migration guide may be needed.
- Report all findings to the user.

## Error handling

- If any script fails, read its stderr output and fix the issue before retrying.
- If `set-private.cjs` fails on an unknown alias, check the alias table above or `.cursor/scripts/release/config.cjs`.
- If `bump.cjs` reports "No changesets found", verify that `.changeset/*.md` files exist for the target packages.
- If `create-pr.cjs` fails, ensure `gh` CLI is authenticated (`gh auth status`) and the branch is pushed.
- Never force-push or amend commits that have been pushed to a shared branch.
