# Copilot review instructions: device-sdk-ts

The Device Management Kit (DMK) is a TypeScript monorepo (pnpm + turbo) for talking to Ledger devices.

- Every package under `packages/*` is a published library: the same rules apply and a changeset is required. The exceptions are packages with `"private": true` in their `package.json` (`config/*`, `tools/*`, `ui`). The main ones are `device-management-kit`, `signer/*` (including `context-module`) and `transport/*`.
- Private apps are in `apps/*`.

Path-specific rules live in `.github/instructions/*.instructions.md`.

## Comment only when it matters

- Review only what this PR changes. Don't comment on existing code the PR doesn't touch, even if it breaks these rules. Exception: a change that breaks or relies on code elsewhere, e.g. a modified public API whose callers or docs aren't updated.
- Comment only on real defects or clear rule violations. If unsure, stay silent.
- Use one comment per issue, give a concrete fix, and prefix it with **blocking:** or **nit:**.
- No praise, no summary of the diff, no restating what the code does.

## Do NOT comment on (CI already enforces it, or it is intentional)

- Formatting, quotes, semicolons, import order: Prettier and `simple-import-sort` handle them.
- Type and lint errors: `tsc --strict` (with `noUncheckedIndexedAccess`) and ESLint run on every PR.
- Branch names, commit messages, PR title format, signed commits, one package per changeset: Danger (`danger/helpers.ts`) enforces them.
- Commit history (atomic commits, merge commits, rebasing): maintainers handle it at merge time.
- Generic code-quality metrics that SonarCloud reports on every PR: coverage percentage, duplicated blocks, cognitive complexity and function length, generic code smells (nested ternaries, magic numbers, TODO comments). Still flag missing tests for new behavior and the repo-specific security rules below; Sonar doesn't know them.
- Generated or derived files: `lib/`, `dist/`, `CHANGELOG.md`, `pnpm-lock.yaml`, `_templates/**`.
- Returning `Either` / `Maybe` (purify-ts) or `CommandResult` / `DmkResult` instead of throwing. This is the error-handling model.
- `_`-prefixed private fields or unused params (`private _container`, `(_) => ...`).
- `@inject(SYMBOL)` constructor params that look unused, and `import "reflect-metadata"` side-effect imports (inversify DI).
- Barrel `index.ts` files.
- Path aliases `@api/*`, `@internal/*`, `@root/*` instead of `../` (relative parent imports are banned).
- `Uint8Array` instead of `Buffer` (required for portability).
- Targeted `eslint-disable-next-line` for `no-explicit-any` / `no-unsafe-*` in tests and XState typing.
- Code duplicated across signer kits: each kit is meant to stay standalone.

The team ignores these comments, so don't write them:

- The wording of code comments, JSDoc, log or error messages, READMEs and changelog entries: typos, grammar, a slightly stale line. Exception: a doc that describes public API behavior wrongly.
- Mismatches between the wording of the PR title or description and the code. Review the code, not the description's wording.
- Requests for more test cases in a file that already has a co-located test file.
- Hypothetical defensive checks ("if this ever receives…") on values that are typed or validated upstream. That includes caller-provided command arguments (the device rejects malformed APDUs) and prototype keys (`__proto__`, `toString`) in lookups on internal constant tables.
- Dependency version choices in `pnpm-workspace.yaml` and the lockfile (range vs exact pin, version skew between packages).

## Focus on

1. **Public API boundary:**
   - `src/api/` is public and `src/internal/` is private. Nothing from `internal/` may be re-exported through `src/api/index.ts` or `src/index.ts`.
   - A removed or renamed public export is a breaking change.
2. **Runtime portability:**
   - Library code runs in browsers, Node, React Native and Hermes. Flag `Buffer`, `process`, `node:*` imports, `URL`, `Blob`, `ReadableStream`, `atob` / `btoa`, `AbortSignal.timeout` / `any`.
   - Exception: packages whose `eslint.config.mjs` spreads `nodeRuntimeOverrides` or `webRuntimeOverrides`.
3. **Error handling:**
   - Errors are typed classes with a `_tag` (see `packages/device-management-kit/src/api/Error.ts`).
   - Flag `throw` in library code paths, swallowed `Left` results, and status words that aren't mapped to a typed error.
   - `CommandResultFactory` belongs only under `**/command/**`; elsewhere, use `DmkResultFactory`.
4. **DI wiring:** a new service or use case is bound in `<feature>/di/<feature>Module.ts`, with its symbol in `<feature>Types.ts`, and loaded in the package `di.ts`.
5. **Byte handling:** check APDU construction for off-by-one errors, wrong endianness and chunking above 255 bytes. Check that the parsing of device and network responses has length and bounds checks.
6. **Security:**
   - No private keys, seeds or full payloads in logs.
   - Treat data from the device, the network or the CAL as untrusted.
   - No new dependency without a justification in the PR description.
7. **Tests:** in `packages/*`, flag each new or changed file with logic (command, task, service, device action, use case) that has no co-located `*.test.ts`, even when other files in the PR have tests. Also flag a bug fix without a non-regression test. Tests are optional in `apps/*`. How to test each layer is described in `.github/instructions/tests.instructions.md`.
8. **Changesets:**
   - Flag a missing changeset when the source of a published package changes. Danger only warns about it.
   - The bump follows `CONTRIBUTING.md`:
     - `major` for a breaking change (removed or renamed export, changed signature, stricter input type)
     - `minor` for a new feature or new public API (export, method, option)
     - `patch` for a fix or a non-breaking internal change
   - Flag a clear mismatch only: a breaking change not released as `major`, or a new public API released as `patch`. Don't comment on the changeset wording.
   - Several changesets for one package are fine. Changesets for `apps/*` and private packages are not needed.
9. **Docs:** if the public API changes, `apps/docs` and the package `README.md` must follow.
10. **PR description** (`CONTRIBUTING.md` requires a full one): flag a PR whose description is empty, still contains the template's placeholder text, or doesn't say what changes and why.
11. **Package manager:** the repo uses pnpm (versions pinned by proto in `.prototools`). Flag an added `package-lock.json` or `yarn.lock`, and `npm`/`yarn` commands in `package.json` scripts, CI workflows or contributor docs. Install instructions for package consumers (`npm install @ledgerhq/...` in READMEs and `apps/docs`) are correct.

## Release and backmerge PRs

Release PRs (to `main`) and backmerge PRs (`chore/backmerge` → `develop`) only contain version bumps, `CHANGELOG.md`, consumed `.changeset/` files, `private` flags and pinned dependencies, all generated by the release scripts. Don't review that content.

## References

- `AGENTS.md`, `CONTRIBUTING.md`: workflow, branch, commit and changeset rules.
- `agent-files/skills/commit/SKILL.md`, `agent-files/skills/changeset/SKILL.md`.
- `packages/config/eslint/index.js`: lint rules (source of truth).
