---
applyTo: "packages/signer/**"
---

# Signer kits (`packages/signer/*`)

Every signer kit has the same shape. When a new file is placed differently, treat it as a structure problem. Use `packages/signer/signer-eth` as the reference.

## Layout

- `src/api/`: public API only. It holds `Signer<Coin>.ts` (interface), `Signer<Coin>Builder.ts`, `model/`, and `app-binder/*Types.ts` (the DA and command input/output types).
- `src/internal/`: private. Nothing in it may be re-exported from `src/api/index.ts` or `src/index.ts`.
  - `DefaultSigner<Coin>.ts` and `di.ts` (the inversify container).
  - `<feature>/di/<feature>Module.ts` + `<feature>Types.ts` (symbols), and `<feature>/use-case/<Name>UseCase.ts`.
  - `app-binder/<Coin>AppBinder.ts`, then `command/`, `task/`, `device-action/` and `di/`.
- `src/index.ts` starts with `import "reflect-metadata"`. Keep it there.

## Commands (`internal/app-binder/command/`)

- Implement `Command<Response, Args, ErrorCodes>` with `getApdu()` (built with `ApduBuilder`) and `parseResponse()` (parsed with `ApduParser`).
- Map status words through `CommandErrorHelper` (from `@ledgerhq/signer-utils`) and the app error table and factory in `command/utils/<coin>AppErrors.ts`. Flag hand-rolled status-word handling.
- `CommandResultFactory` is correct here. Outside `**/command/**`, use `DmkResultFactory` (an ESLint warning enforces this).
- **Review carefully:**
  - The APDU byte layout: CLA/INS/P1/P2, length prefixes, chunking above 255 bytes.
  - Bounds checks when parsing: a missing `Maybe` check on `extract*` results is a real bug.
  - Derivation path handling through `DerivationPathUtils`.

## Tasks and device actions

- Tasks (`task/`) chain several commands and return a `CommandResult` / `Either`. They don't throw.
- Device actions extend the DMK `XStateDeviceAction` and usually start by opening the app (`OpenAppDeviceAction`). See `device-actions.instructions.md`.

## Clear signing / context-module

- Transaction and message context (tokens, NFTs, Safe, fields) comes from `@ledgerhq/context-module` loaders. Signer code must not fetch it from the network directly.
- A device rejection or "blind signing disabled" must surface as a typed error. It must not be swallowed.

## Do not flag

- `_`-prefixed private members (`_appBinder`, `_container`).
- `@inject(...)` constructor params that look unused.
- Very similar code across signer kits: the copies are intentional, so that each kit stays independent.
