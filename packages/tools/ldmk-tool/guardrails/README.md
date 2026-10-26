# Guardrails

Deterministic checks on the shape of the code: which package may depend on which, which layer may import which, and how signer kits and transports lay out their files. They run in CI on every PR, in the **Guardrails** job.

> The job is informational for now: it fails on a broken rule, but it doesn't block the merge. It becomes required once every package is green.

## Run it

| Command                                                     | What it checks                                                                                                                                                        |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm guardrails` (in a kit or transport)                   | The package: `[deps]` its `package.json` and imports, `[layers]` its layers, `[tree]` its file tree                                                                   |
| `pnpm ldmk-tool guardrails --package <dir>` (from the root) | The same, for any package                                                                                                                                             |
| `pnpm ldmk-tool guardrails --repo`                          | `[deps]` and README/CHANGELOG for the packages without a role, the workspace graph, and the `guardrails` script of every kit and transport (`tree/guardrails-script`) |
| `pnpm guardrails` (at the root)                             | Both: `--repo`, then every kit and transport                                                                                                                          |

`--repo --affected` limits the report to the packages changed against `TURBO_SCM_BASE`, and the packages that depend on them, the way CI runs it. `--strict` also fails when the package has `exceptions` or `extraFolders`: the signer generator uses it to check the kits it writes.

The code lives in this folder: the rules and their messages in [`rules.mjs`](rules.mjs), the roles in [`roles/`](roles), and one file per check.

The checker's own tests run with `pnpm --filter @ledgerhq/ldmk-tool test:guardrails`. They are not part of `pnpm test`: like the rest of the Guardrails job, they don't block a merge yet.

## One file per package

Every signer kit and transport has a `guardrails.config.mjs` that picks a **role**:

```js
// packages/signer/signer-xrp/guardrails.config.mjs
import { defineGuardrails, signerKit } from "@ledgerhq/ldmk-tool/guardrails";

export default defineGuardrails({ role: signerKit });
```

| Role                       | Packages                                                     | Checks                                                               |
| -------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------- |
| `signerKit`                | `packages/signer/signer-*`, except `signer-utils`            | `[deps]` `[layers]` `[tree]`                                         |
| `signerKit.featureFolders` | signer-eth: `internal/<feature>/{use-case,di,service,model}` | `[deps]` `[layers]` `[tree]`                                         |
| `transport`                | rn-hid, speculos, mockserver                                 | `[deps]` `[layers]` `[tree]`, with only the entry points fixed       |
| `transport.webFamily`      | web-hid, web-ble, node-hid, rn-ble                           | `[deps]` `[layers]` `[tree]`, with the web-family layout             |
| `generic`                  | every other package (no file needed)                         | `[deps]` on `package.json`, plus README and CHANGELOG when published |

Each package also belongs to a **group**, by path, in [`groups.mjs`](groups.mjs). `[deps]` uses the groups.

## When a package is different

A package's file can bend its role in two ways, and each needs a `reason`:

```js
export default defineGuardrails({
  role: signerKit,
  // [tree]: a folder the role doesn't know about
  extraFolders: [
    {
      path: "src/internal/app-binder/clear-sign",
      reason: "Clear-sign domain logic",
    },
  ],
  // One rule lifted for one file, one dependency, or (for [tree]) a glob
  exceptions: [
    {
      rule: "tree/task-name",
      path: "src/internal/app-binder/task/Helpers.ts",
      reason: "…",
    },
  ],
});
```

`extraFolders` only works with a role that lists its folders: `signerKit`, `signerKit.featureFolders` and `transport.webFamily`. An exception's `path` depends on the rule:

- `[layers]`, and the `[deps]` rules on imports (`deps/declared`, `deps/no-deep`): one file, such as `src/api/model/Errors.ts`. No wildcards.
- The other `[deps]` rules: one dependency, as `package.json#<dependency>` (for example `package.json#@ledgerhq/context-module`), or `package.json` for `deps/no-cycles`. No wildcards. An exception for a dependency covers both its `package.json` entry and the files that import it.
- `[tree]`: a file, a folder or a glob.

`deps/group-declared`, `tree/guardrails-config`, `tree/guardrails-script` and `tree/strict` can't be excepted: they decide whether, and how, the package is checked at all. So a package can't relax `[deps]` or `[layers]` as a whole. An exception or extra folder that no longer matches anything is reported as a warning, so it can be removed. Generic packages have no file, so their violations must be fixed.

## Reading a failure

```
✖ @ledgerhq/device-signer-kit-zcash  (role: signerKit)

  [layers] layers/command-is-leaf
    src/internal/app-binder/command/SignPcztTransparentCommand.ts:23
      imports src/internal/app-binder/task/utils/legacyTransactionUtils.ts, which is in the task layer
    Why:  Commands are the lowest layer: one self-contained APDU class each.
    Fix:  Move what the command needs to src/internal/app-binder/command/utils/, or into the command itself.
    Docs: packages/tools/ldmk-tool/guardrails/README.md#layerscommand-is-leaf
```

Fix the code, or, when the code is right, add an `exceptions` entry with a reason. Each rule is described below.

In CI, the job log has every error. Inline annotations in the PR diff only show the errors in files the PR changed: GitHub shows only the first 10 errors of a step, and the existing violations would hide the new ones.

## `[deps]` Dependencies

Checked on `package.json`, and on the real `import` lines with dependency-cruiser. The allowed edges between groups are in [`edges.mjs`](edges.mjs):

| from \ to     | core | signerSupport | signerKit | transport | testInfra | devtools | tooling, config   |
| ------------- | ---- | ------------- | --------- | --------- | --------- | -------- | ----------------- |
| core          |      |               |           |           |           |          | dev               |
| signerSupport | peer | any           |           |           |           |          | dev               |
| signerKit     | peer | any           |           |           |           |          | dev               |
| transport     | peer |               |           |           | any ¹     |          | dev               |
| trustedApp    | peer | any           |           |           |           |          | dev               |
| testInfra     | peer |               |           |           | any       |          | dev               |
| devtools      | peer |               |           |           | any       | any      | dev               |
| tooling       | peer | any           | peer      | any       | any       | any      | any (config: dev) |
| app           | any  | any           | any       | any       | any       | any      | any               |

`any` = dependencies, peerDependencies or devDependencies; `peer` = peerDependencies + devDependencies; `dev` = devDependencies only; blank = forbidden. ¹ Only `@ledgerhq/device-mockserver-client`. Apps may only depend on other apps as devDependencies, and nothing else may depend on an app. `packages/ui` (group `ui`) may use the core as a peer.

### deps/group-declared

Every workspace package matches a group in [`groups.mjs`](groups.mjs). Signer kits and transports also have a `guardrails.config.mjs`, whose role matches their path.

### deps/edge-allowed

Every dependency on another workspace package, and every import of one, follows the table above. Production code may not import a package that its group may only use as a devDependency.

### deps/core-is-peer

`@ledgerhq/device-management-kit` is in `peerDependencies` and `devDependencies`, never in `dependencies` (apps excepted). The app and all its kits share one DMK instance.

### deps/no-duplicate-kind

No package is in both `dependencies` and `peerDependencies`.

### deps/context-module-kind

A signer kit declares `@ledgerhq/context-module` in one of the two forms in use today: `dependencies` only (like signer-solana), or `peerDependencies` + `devDependencies` (like signer-eth). Never a mix.

### deps/no-public-to-private

A published package has no `dependencies` or `peerDependencies` entry on a private workspace package.

### deps/no-cycles

The workspace graph, with every kind of dependency, has no cycle: Turbo must be able to build the packages in one order.

Only `--repo` checks it. A cycle is reported on the first of its packages, by path, so an exception for it goes in that package's `guardrails.config.mjs`.

### deps/declared

Every imported `@ledgerhq/*` package is declared in `package.json`. An undeclared import only works because of hoisting.

### deps/no-deep

Other packages are imported from their root only: `@ledgerhq/signer-utils`, never `@ledgerhq/signer-utils/lib/...`.

## `[layers]` Layers

Checked on the real imports with dependency-cruiser, type-only imports included. Test files (`*.test.ts`, `*.spec.ts`, `*.stories.tsx`, `__tests__/`, `__test-utils__/`, `__mocks__/`, `__fixtures__/`) are not checked.

Signer kit layers, top to bottom:

```
src/index.ts          only re-exports @api/index
src/api/**            public: names internal types, only the Builder creates internal classes
DefaultSigner, di.ts  (and *Module.ts, <feature>/di/)
use cases             use-cases/** (or <feature>/use-case/**)
app binder            app-binder/*AppBinder.ts, app-binder/di/**
device actions        app-binder/device-action/**
tasks                 app-binder/task/**
commands              app-binder/command/**: one APDU each, imports no other command
```

Folders off the ladder (`shared/`, `utils/`, `clear-sign/`, …) are domain code: any layer may use them, and they may not import use cases. Commands may use domain constants and models, but no services. DI token files (`di/*Types.ts`) can be imported from any layer above the commands.

### layers/index-only-api

A signer kit's `src/index.ts` only re-exports `src/api/index.ts`.

### layers/api-internal-type-only

`src/api/**` imports `src/internal/**` with `import { type X }` only. `Signer*Builder.ts`, `src/api/index.ts` and `*Factory.ts` may create internal classes.

### layers/ladder

No layer imports a layer above it, and domain code doesn't import use cases.

### layers/command-is-leaf

A command imports no task, device action, use case, app binder, service or `DefaultSigner`, not even a type.

### layers/command-no-command

A command doesn't import another `*Command.ts`, not even a type. Shared parts go to `command/utils/`.

### layers/no-circular

No runtime import cycle inside the package. Cycles that go through a type-only import are ignored. A common cause is a type imported without the `type` keyword from a barrel such as `@api/index`.

### layers/internal-not-exported

A transport's `src/index.ts` doesn't re-export anything from `src/internal/`.

## `[tree]` File tree

Read from the files git knows about (tracked or untracked, never ignored).

### tree/required

Signer kit: `src/index.ts`, `src/api/index.ts`, `src/api/Signer<X>.ts`, exactly one `src/api/Signer<X>Builder.ts`, `src/api/model/`, `src/internal/DefaultSigner<X>.ts`, `src/internal/di.ts`, `src/internal/app-binder/command/`, and exactly one `src/internal/app-binder/*AppBinder.ts`. `<X>` comes from the Builder name.

Transport: `src/index.ts` and exactly one `*Transport.ts`. The web family also needs `src/api/index.ts`, `src/api/transport/<X>Transport.ts`, `src/api/transport/<X>ApduSender.ts` and `src/api/model/Errors.ts`.

### tree/allowed-folders

At each listed level, only the role's folders, `__*__` test folders, and the package's `extraFolders`. Directly in `src/`, the only file is `index.ts` (test files aside):

| Level                      | Signer kit                                                                                                                       | Web-family transport         |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| `src/`                     | `api`, `internal`                                                                                                                | `api`                        |
| `src/api/`                 | `app-binder`, `model`                                                                                                            | `data`, `model`, `transport` |
| `src/internal/`            | `app-binder`, `use-cases`, `shared`, `utils` (featureFolders: any feature, containing only `use-case`, `di`, `service`, `model`) |                              |
| `src/internal/app-binder/` | `command`, `task`, `device-action`, `di`, `services`, `utils`                                                                    |                              |

### tree/command-name

Files directly in `command/` end with `Command.ts`.

### tree/task-name

Files directly in `task/` end with `Task.ts`.

### tree/device-action-location

`device-action/<Name>/<Name>DeviceAction.ts` and its `.types.ts`. Factories that pick a device action may sit directly in `device-action/` as `*DeviceActionFactory.ts`.

### tree/file-case

Signer kits only. Production `.ts` files are in PascalCase or camelCase.

### tree/folder-case

Signer kits only. Folders are in kebab-case (or `__*__`). Folders directly in `device-action/` use the PascalCase name of their device action.

### tree/package-files

Signer kits and transports have `package.json`, `README.md`, `CHANGELOG.md` (when published), `eslint.config.mjs`, `tsconfig.json`, `tsconfig.prod.json`, `vitest.config.mjs` and `guardrails.config.mjs`; the `build`, `lint`, `prettier`, `typecheck` and `test` scripts; and an `exports["."]` with `types` and `import`. Other published packages have a `README.md` and a `CHANGELOG.md`.

### tree/guardrails-config

The package's `guardrails.config.mjs` loads, and passes `defineGuardrails()`. The package's own run stops on the error (exit 2), and `--repo` reports it too, since that run may never happen.

### tree/guardrails-script

Signer kits and transports have the script `"guardrails": "pnpm ldmk-tool guardrails"`, exactly. Without it, or with another command, `turbo run guardrails` doesn't check the package, so `--repo` checks it.

### tree/strict

Only checked with `--strict`, which the signer generator runs on the kit it just wrote. A freshly generated kit passes without `exceptions` or `extraFolders`: if it needs one, the templates and the rules disagree.
