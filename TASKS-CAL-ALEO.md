# Developer Tasks: CAL Token Metadata Integration for signer-aleo

Source plan: `goofy-drifting-dolphin.md`
Branch: `feat/LIVE-30417-aleo-dynamic-cal-poc`

---

## Overview

Integrate Ledger CAL (Crypto Asset List) token metadata into the `signer-aleo` signing flow so that the Ledger device can display human-readable token information (name, decimals) during signing instead of raw bytes.

The work spans two packages:
- `packages/signer/context-module/` — new Aleo token loader
- `packages/signer/signer-aleo/` — new XState signing machine, device command, tasks, and DI wiring

**Prerequisite resolved (2026-05-15):** Firmware team confirmed `CMD_PROVIDE_TOKEN` INS = `0x08`. Tasks 7 and 9 are now unblocked. Tasks 1–6, 8, 10–12 are complete.

---

## Task Index

| # | Task | Blocked? |
|---|------|----------|
| [1](#task-1-create-aleotoken-di-types) | Create aleoToken DI types | ✅ Done |
| [2](#task-2-create-aleotoken-data-source-interface) | Create AleoTokenDataSource interface | ✅ Done |
| [3](#task-3-create-httpaleotoken-datasource) | Create HttpAleoTokenDataSource | ✅ Done |
| [4](#task-4-create-aleotoken-context-loader) | Create AleoTokenContextLoader | ✅ Done |
| [5](#task-5-create-aleotoken-module-factory) | Create aleoTokenModuleFactory | ✅ Done |
| [6](#task-6-wire-aleo-loader-into-context-module) | Wire Aleo loader into ContextModule | ✅ Done |
| [7](#task-7-create-providetoken-information-command) | Create ProvideTokenInformationCommand | **Ready** — INS=0x08 confirmed |
| [8](#task-8-create-buildaleotokencontexttask) | Create BuildAleoTokenContextTask | ✅ Done |
| [9](#task-9-create-providealeotokencontexttask) | Create ProvideAleoTokenContextTask | **Ready** — unblocked |
| [10](#task-10-create-signrootintentdeviceaction-xstate-machine) | Create SignRootIntentDeviceAction (XState) | ✅ Done (tests pending) |
| [11](#task-11-update-aleoappbinder) | Update AleoAppBinder to use new device action | ✅ Done |
| [12](#task-12-wire-contextmodule-into-signer-aleo-di) | Wire ContextModule into signer-aleo DI | ✅ Done |

---

## Task 1: Create aleoToken DI Types

### What
Create an Inversify symbol file for the Aleo token module's injectable services.

### Where
**Create new file:**
`packages/signer/context-module/src/aleoToken/di/aleoTokenTypes.ts`

### Reference
`packages/signer/context-module/src/solanaToken/di/tokenTypes.ts`

### Implementation
```typescript
export const aleoTokenTypes = {
  AleoTokenDataSource: Symbol.for("AleoTokenDataSource"),
  AleoTokenContextLoader: Symbol.for("AleoTokenContextLoader"),
};
```

### How to Test
No dedicated unit test needed. Type compilation validates correct usage. Integration test via Task 5.

### Definition of Done
- [ ] File created at the correct path
- [ ] Two symbols exported: `AleoTokenDataSource` and `AleoTokenContextLoader`
- [ ] `pnpm run signer-aleo build` passes (no compile error from the new file)

---

## Task 2: Create AleoTokenDataSource Interface

### What
Define the data-source interface that `HttpAleoTokenDataSource` will implement, and the request/response types it uses.

### Where
**Create new file:**
`packages/signer/context-module/src/aleoToken/data/AleoTokenDataSource.ts`

### Reference
`packages/signer/context-module/src/solanaToken/data/SolanaTokenDataSource.ts`

### Implementation Details
- Define `GetAleoTokenInfosParams` type: `{ tokenInternalId: string }`
- Import `TokenDataResponse` from solana (same CAL response shape) **or** declare a local `AleoTokenDataResponse` if the Aleo CAL endpoint returns a different shape
  - Use the same shape for now (mirroring Solana); adjust when the real CAL endpoint ships
- Declare `AleoTokenDataSource` as an interface with one method:
  ```typescript
  getTokenInfosPayload(params: GetAleoTokenInfosParams): Promise<Either<Error, TokenDataResponse>>
  ```
- Use `Either` from `purify-ts`

### How to Test
No unit test for a pure interface. Validated indirectly by Task 3's tests.

### Definition of Done
- [ ] Interface file exists with `GetAleoTokenInfosParams` type and `AleoTokenDataSource` interface
- [ ] Uses `Either<Error, TokenDataResponse>` return type
- [ ] Compiles cleanly

---

## Task 3: Create HttpAleoTokenDataSource

### What
Implement the HTTP client that fetches Aleo token descriptor data from the CAL API.

### Where
**Create new file:**
`packages/signer/context-module/src/aleoToken/data/HttpAleoTokenDataSource.ts`

### Reference
`packages/signer/context-module/src/solanaToken/data/HttpSolanaTokenDataSource.ts`

### Implementation Details
- `@injectable()` class, `implements AleoTokenDataSource`
- Constructor injects:
  - `@inject(configTypes.Config) private readonly config: ContextModuleServiceConfig`
  - `@inject(networkTypes.NetworkClient) private readonly http: DmkNetworkClient`
- `getTokenInfosPayload` method:
  - Calls `this.http.get(${this.config.cal.url}/tokens, { params: { id: tokenInternalId, output: "id,name,network,network_family,ticker,decimals,descriptor,...", ref: "branch:" + this.config.cal.branch } })`
  - Cast result to `TokenDataResponse[]`, return `Right(data[0])` if present
  - Return `Left(new Error("[ContextModule] HttpAleoTokenDataSource: Failed to fetch token informations"))` on any error
- **Note:** The exact `output` query param fields may change when the Aleo CAL endpoint ships. Mirror the Solana list exactly for now.

### How to Test
**Create new file:**
`packages/signer/context-module/src/aleoToken/data/__tests__/HttpAleoTokenDataSource.test.ts`

Reference: `packages/signer/context-module/src/solanaToken/data/__tests__/HttpSolanaTokenDataSource.test.ts`

Test cases:
1. Happy path: mock `http.get` returning `[tokenDataResponse]`, assert `Right(tokenDataResponse)` is returned
2. Empty array returned by API: assert `Left(Error)` is returned
3. `http.get` throws: assert `Left(Error)` is returned
4. Assert correct URL and query params are passed to `http.get` (especially `id` and `ref`)

### Definition of Done
- [ ] Class compiles and is `@injectable()`
- [ ] Returns `Either<Error, TokenDataResponse>` correctly
- [ ] Unit tests cover happy path, empty response, and error case
- [ ] All tests pass: `pnpm run signer-aleo test` (or context-module test)

---

## Task 4: Create AleoTokenContextLoader

### What
Core domain logic: determine if Aleo token context is needed for a given signing request, fetch the token descriptor and PKI certificate, and return a structured result.

### Where
**Create new file:**
`packages/signer/context-module/src/aleoToken/domain/AleoTokenContextLoader.ts`

### Reference
`packages/signer/context-module/src/solanaToken/domain/SolanaTokenContextLoader.ts`

### Implementation Details

**Define supporting types** (either in this file or a sibling `model.ts`):
```typescript
export type AleoTransactionContext = {
  tokenInternalId: string;
  deviceModelId: DeviceModelId;
};

export type AleoTokenContextResult = {
  type: "ALEO_TOKEN";
  payload: {
    aleoTokenDescriptor: {
      data: string;       // hex-encoded descriptor bytes
      signature: string;  // hex-encoded ECDSA signature
    };
  };
  certificate: PkiCertificate;
};

export type AleoBuildContextResult = {
  loadersResults: AleoTokenContextResult[];
  certificate: PkiCertificate | undefined;
};
```

**Class `AleoTokenContextLoader`:**
- `@injectable()`, implements a suitable loader interface (follow Solana pattern)
- Constructor injects:
  - `@inject(aleoTokenTypes.AleoTokenDataSource) private readonly dataSource: AleoTokenDataSource`
  - `@inject(configTypes.Config) private readonly config: ContextModuleServiceConfig`
  - `@inject(pkiTypes.PkiCertificateLoader) private readonly certificateLoader: PkiCertificateLoader`
  - `@inject(configTypes.ContextModuleLoggerFactory) loggerFactory: (tag: string) => LoggerPublisherService`
- `canHandle(field: unknown): field is AleoTransactionContext`:
  - Returns `true` if `field` is an object with a non-empty `tokenInternalId` string
- `loadField(context: AleoTransactionContext): Promise<AleoTokenContextResult>`:
  1. Call `this.dataSource.getTokenInfosPayload({ tokenInternalId: context.tokenInternalId })`
  2. If `Left(error)` → log and return error result
  3. Select signature: `config.cal.mode === "prod" ? descriptor.signatures.prod : descriptor.signatures.test`
  4. Call `this.certificateLoader.loadCertificate({ keyId: "aleo_token_metadata_key", keyUsage: CoinMeta, targetDevice: context.deviceModelId })`
  5. Return `AleoTokenContextResult` with descriptor data/signature and the loaded certificate

**Certificate key name `"aleo_token_metadata_key"`** is a placeholder — confirm with the Ledger PKI/CAL team before production.

### How to Test
**Create new file:**
`packages/signer/context-module/src/aleoToken/domain/__tests__/AleoTokenContextLoader.test.ts`

Reference: `packages/signer/context-module/src/solanaToken/domain/__tests__/SolanaTokenContextLoader.test.ts`

Test cases:
1. `canHandle` returns `true` for object with valid `tokenInternalId`
2. `canHandle` returns `false` for object without `tokenInternalId`, null, or wrong type
3. Happy path `loadField`: mock `dataSource` returning `Right(tokenData)`, mock `certificateLoader` returning certificate, assert result shape is correct
4. Data source returns `Left(error)`: assert error is propagated correctly
5. Certificate loader throws: assert error is propagated correctly
6. Prod vs test mode: assert correct signature variant is selected based on `config.cal.mode`

### Definition of Done
- [ ] `canHandle` and `loadField` are implemented and exported
- [ ] `AleoTransactionContext` and `AleoTokenContextResult` types are exported
- [ ] Unit tests cover all test cases above
- [ ] All tests pass

---

## Task 5: Create aleoTokenModuleFactory

### What
Inversify `ContainerModule` factory that binds the Aleo token data source and loader so they can be injected.

### Where
**Create new file:**
`packages/signer/context-module/src/aleoToken/di/aleoTokenModuleFactory.ts`

### Reference
`packages/signer/context-module/src/solanaToken/di/tokenModuleFactory.ts`

### Implementation
```typescript
import { ContainerModule } from "inversify";
import { aleoTokenTypes } from "./aleoTokenTypes";
import { HttpAleoTokenDataSource } from "../data/HttpAleoTokenDataSource";
import { AleoTokenContextLoader } from "../domain/AleoTokenContextLoader";

export const aleoTokenModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(aleoTokenTypes.AleoTokenDataSource).to(HttpAleoTokenDataSource);
    bind(aleoTokenTypes.AleoTokenContextLoader).to(AleoTokenContextLoader);
  });
```

### How to Test
No standalone unit test. Integration test: verify that a container built with `aleoTokenModuleFactory()` can resolve `aleoTokenTypes.AleoTokenDataSource` and `aleoTokenTypes.AleoTokenContextLoader`.

Add to the integration-level test when wiring Task 6 (if a container test exists, mirror it).

### Definition of Done
- [ ] File created, exports `aleoTokenModuleFactory`
- [ ] Bindings use the correct classes and types from Tasks 1–4
- [ ] `pnpm run signer-aleo build` passes

---

## Task 6: Wire Aleo Loader into ContextModule

### What
Expose a `getAleoContext()` method on the public `ContextModule` interface, implement it in `DefaultContextModule`, register the `aleoTokenModuleFactory` in the DI container, and export the new Aleo types from the package index.

### Where
**Modify these existing files:**

| File | Change |
|------|--------|
| `packages/signer/context-module/src/ContextModule.ts` | Add `getAleoContext()` method signature |
| `packages/signer/context-module/src/DefaultContextModule.ts` | Implement `getAleoContext()` |
| `packages/signer/context-module/src/di.ts` | Load `aleoTokenModuleFactory()` in `makeContainer()` |
| `packages/signer/context-module/src/index.ts` | Export new Aleo types |

### Reference
- Solana equivalent: search for `getSolanaContext` in `ContextModule.ts` and `DefaultContextModule.ts`
- Module factory registration: search for `solanaTokenModuleFactory` in `di.ts`

### Implementation Details

**`ContextModule.ts`** — add after `getSolanaContext`:
```typescript
getAleoContext(
  transactionContext: AleoTransactionContext,
): Promise<AleoBuildContextResult>;
```

**`DefaultContextModule.ts`** — add implementation:
```typescript
async getAleoContext(
  transactionContext: AleoTransactionContext,
): Promise<AleoBuildContextResult> {
  // Resolve AleoTokenContextLoader from container
  // Call canHandle + loadField
  // Return AleoBuildContextResult
}
```
Pattern: follow exactly how `getSolanaContext` iterates over its loaders and builds the result.

**`di.ts`** — add factory call inside `makeContainer()`:
```typescript
aleoTokenModuleFactory(),
```

**`index.ts`** — export:
```typescript
export type { AleoTransactionContext, AleoTokenContextResult, AleoBuildContextResult } from "./aleoToken/domain/AleoTokenContextLoader";
export { aleoTokenTypes } from "./aleoToken/di/aleoTokenTypes";
export { aleoTokenModuleFactory } from "./aleoToken/di/aleoTokenModuleFactory";
```

### How to Test
**Update or create:** `packages/signer/context-module/src/__tests__/DefaultContextModule.test.ts`

Test cases for `getAleoContext`:
1. With a valid `tokenInternalId`: assert `loadersResults` contains one entry of type `ALEO_TOKEN`
2. Without `tokenInternalId` (or loader returns error): assert `loadersResults` is empty or contains error
3. Mock the entire `AleoTokenContextLoader` — verify that `getAleoContext` calls `canHandle` and then `loadField`

### Definition of Done
- [ ] `getAleoContext` is in the interface and implemented
- [ ] All classes that implement `ContextModule` compile (no missing method errors)
- [ ] `aleoTokenModuleFactory` is loaded in the container
- [ ] New types are exported from `index.ts`
- [ ] Unit tests pass
- [ ] `pnpm -F context-module build` compiles cleanly

---

## Task 7: Create ProvideTokenInformationCommand

> ✅ **INS byte confirmed:** Firmware team confirmed `CMD_PROVIDE_TOKEN` INS = `0x08` on 2026-05-15. This task is unblocked.

### What
APDU command that sends the attested Aleo token descriptor to the device. The device will use this to verify the token signature and display human-readable token info during signing.

### Where
**Create new file:**
`packages/signer/signer-aleo/src/internal/app-binder/command/ProvideTokenInformationCommand.ts`

**Modify existing file:**
`packages/signer/signer-aleo/src/internal/app-binder/command/utils/apduHeaderUtils.ts`

### Reference
`packages/signer/signer-solana/src/internal/app-binder/command/ProvideTLVTransactionInstructionDescriptorCommand.ts`

### Implementation Details

**`apduHeaderUtils.ts`** — add to `INS`:
```typescript
export const INS = {
  GET_APP_VERSION: 0x03,
  GET_ADDRESS: 0x05,
  SIGN_INTENT: 0x06,
  GET_VIEW_KEY: 0x07,
  PROVIDE_TOKEN: 0x08,  // CMD_PROVIDE_TOKEN — confirm with firmware team
} as const;
```

**`ProvideTokenInformationCommand.ts`:**
```typescript
// Args:
type ProvideTokenInformationCommandArgs = {
  dataHex: string;       // hex-encoded descriptor bytes (everything before 0x15 tag)
  signatureHex: string;  // hex-encoded DER ECDSA signature
};

// APDU structure (mirrors Solana command):
// CLA=0xE0, INS=0x08, P1=0x00, P2=0x00
// Data: [dataHex bytes] [0x15 tag: 1 byte] [sigLen: 1 byte] [signatureHex bytes]
// Total data must be ≤ 255 bytes
```

- Validate that `signatureHex` decodes to 70–72 bytes (DER-encoded ECDSA sig)
- Build `Uint8Array` from data + tag + length + signature
- Return `CommandResult<void>` parsing only for success/failure status word

### How to Test
**Create new file:**
`packages/signer/signer-aleo/src/internal/app-binder/command/__tests__/ProvideTokenInformationCommand.test.ts`

Reference: `packages/signer/signer-solana/src/internal/app-binder/command/__tests__/ProvideTLVTransactionInstructionDescriptorCommand.test.ts`

Test cases:
1. Correct APDU bytes are generated for valid input (assert `CLA=0xE0`, `INS=0x08`, `P1=0x00`, data bytes match expected layout)
2. `0x15` tag is present at the correct position in the data payload
3. Signature length byte matches actual signature length
4. Input validation: too-short or too-long signature throws/returns error
5. Successful `0x9000` response is parsed as `Right(undefined)`
6. Error status word (e.g., `0x5720`) is parsed as `Left` with correct error

### Definition of Done
- [ ] `INS.PROVIDE_TOKEN = 0x08` added to `apduHeaderUtils.ts`
- [ ] Command class created, compiles, and is exported
- [ ] APDU layout matches the wire format agreed with firmware team
- [ ] Unit tests cover APDU construction and response parsing
- [ ] All tests pass

---

## Task 8: Create BuildAleoTokenContextTask

### What
A task that, given a `tokenInternalId` and a `ContextModule`, fetches the token descriptor and PKI certificate from CAL and returns a structured context object ready to be sent to the device.

### Where
**Create new file:**
`packages/signer/signer-aleo/src/internal/app-binder/task/BuildAleoTokenContextTask.ts`

### Reference
`packages/signer/signer-solana/src/internal/app-binder/task/BuildTransactionContextTask.ts`

### Implementation Details

```typescript
type BuildAleoTokenContextTaskArgs = {
  contextModule: ContextModule;
  tokenInternalId: string;
  deviceModelId: DeviceModelId;
};

export class BuildAleoTokenContextTask {
  constructor(private readonly args: BuildAleoTokenContextTaskArgs) {}

  async run(internalApi: InternalApi): Promise<AleoBuildContextResult> {
    const { contextModule, tokenInternalId, deviceModelId } = this.args;

    // Note: Aleo does NOT need a device challenge (unlike Solana trusted-name flow)
    // Just call getAleoContext directly

    const result = await contextModule.getAleoContext({
      tokenInternalId,
      deviceModelId,
    });

    return result;
  }
}
```

The Aleo flow is simpler than Solana's because:
- No `GetChallengeCommand` is needed
- No `templateId` or message signing context

The task is primarily a thin wrapper to keep the XState machine clean.

### How to Test
**Create new file:**
`packages/signer/signer-aleo/src/internal/app-binder/task/__tests__/BuildAleoTokenContextTask.test.ts`

Reference: `packages/signer/signer-solana/src/internal/app-binder/task/__tests__/BuildTransactionContextTask.test.ts`

Test cases:
1. Happy path: mock `contextModule.getAleoContext` returning `AleoBuildContextResult` with one loader result, assert the task returns it unchanged
2. `contextModule.getAleoContext` rejects: assert the task propagates the error (or wraps it appropriately)
3. Assert `contextModule.getAleoContext` is called with the correct `tokenInternalId` and `deviceModelId`

### Definition of Done
- [ ] Task file created and compiles
- [ ] Task accepts `ContextModule` as a dependency (not hard-coded DI symbol)
- [ ] Unit tests pass with mocked `ContextModule`

---

## Task 9: Create ProvideAleoTokenContextTask

> ✅ **Unblocked:** Task 7 INS byte confirmed (0x08). This task can now proceed.

### What
A task that sends the PKI certificate and token descriptor (from `BuildAleoTokenContextTask` output) to the Ledger device via two commands:
1. `LoadCertificateCommand` — loads the PKI key into the device session
2. `ProvideTokenInformationCommand` — sends the attested token descriptor

### Where
**Create new file:**
`packages/signer/signer-aleo/src/internal/app-binder/task/ProvideAleoTokenContextTask.ts`

### Reference
`packages/signer/signer-solana/src/internal/app-binder/task/ProvideTransactionContextTask.ts` (the `provideTokenMetadataContext` method)

### Implementation Details

```typescript
type ProvideAleoTokenContextTaskArgs = {
  buildContextResult: AleoBuildContextResult;
};

export class ProvideAleoTokenContextTask {
  constructor(private readonly args: ProvideAleoTokenContextTaskArgs) {}

  async run(internalApi: InternalApi): Promise<void> {
    const { buildContextResult } = this.args;

    for (const loaderResult of buildContextResult.loadersResults) {
      if (loaderResult.type !== "ALEO_TOKEN") continue;

      const { certificate } = loaderResult;
      const { data, signature } = loaderResult.payload.aleoTokenDescriptor;

      // Step 1: Load PKI certificate
      const certResult = await internalApi.sendCommand(
        new LoadCertificateCommand({
          payload: certificate.payload,
          keyUsageNumber: certificate.keyUsageNumber,
        })
      );
      if (isCommandResultError(certResult)) {
        throw new Error("Failed to load PKI certificate: " + certResult.error);
      }

      // Step 2: Provide token descriptor
      const tokenResult = await internalApi.sendCommand(
        new ProvideTokenInformationCommand({
          dataHex: data,
          signatureHex: signature,
        })
      );
      if (isCommandResultError(tokenResult)) {
        throw new Error("Failed to provide token information: " + tokenResult.error);
      }
    }
  }
}
```

**`LoadCertificateCommand`** already exists in the codebase (used by Solana). Find it by searching for `LoadCertificateCommand` under `packages/signer/`.

### How to Test
**Create new file:**
`packages/signer/signer-aleo/src/internal/app-binder/task/__tests__/ProvideAleoTokenContextTask.test.ts`

Reference: `packages/signer/signer-solana/src/internal/app-binder/task/__tests__/ProvideTransactionContextTask.test.ts`

Test cases:
1. Happy path: mock `internalApi.sendCommand` returning success for both commands; assert both `LoadCertificateCommand` and `ProvideTokenInformationCommand` were sent in the correct order
2. `LoadCertificateCommand` fails: assert the task throws/returns error and `ProvideTokenInformationCommand` is NOT sent
3. `ProvideTokenInformationCommand` fails: assert the task throws/returns error
4. Empty `loadersResults`: assert no commands are sent
5. Assert `LoadCertificateCommand` receives correct `payload` and `keyUsageNumber` from the certificate

### Definition of Done
- [ ] Task created, compiles, imports `LoadCertificateCommand` and `ProvideTokenInformationCommand`
- [ ] Two-step command sequence (cert then token) is implemented
- [ ] Unit tests cover all cases above
- [ ] All tests pass

---

## Task 10: Create SignRootIntentDeviceAction (XState Machine)

### What
Replace the current `CallTaskInAppDeviceAction + SignRootIntentTask` pattern for root intent signing with a proper XState state machine that conditionally inserts the Build/Provide context states when `tokenInternalId` is provided.

### Where
**Create new file:**
`packages/signer/signer-aleo/src/internal/app-binder/device-action/SignRootIntent/SignRootIntentDeviceAction.ts`

**You may rename or keep** the existing `SignTransaction/SignTransactionDeviceAction.ts` — check whether it currently handles root intent or all transaction types. If it handles all signing, keep it for fee/nested-call flows and create the new XState machine only for root intent.

### Reference
`packages/signer/signer-solana/src/internal/app-binder/device-action/SignTransactionDeviceAction.ts`

Also see how `GetAddressDeviceAction.ts` is structured in signer-aleo as a simpler XState example.

### Implementation Details

**State machine states (in order):**

```
OpenApp → CheckTokenMetadata → [BuildContext → ProvideContext]? → Sign → Success
                                       ↓ (no tokenInternalId)
                                      Sign (skip context)
```

**Types:**
```typescript
type Input = {
  derivationPath: string;
  transaction: Uint8Array;      // root intent bytes
  tokenInternalId?: string;     // optional — triggers CAL context flow
};

type Output = Either<AleoError, Signature>;

type MachineDependencies = {
  getAppConfig: () => Promise<CommandResult<AppConfig>>;
  buildContext: (tokenInternalId: string) => Promise<AleoBuildContextResult>;
  provideContext: (buildResult: AleoBuildContextResult) => Promise<void>;
  signRootIntent: (derivationPath: string, transaction: Uint8Array) => Promise<CommandResult<Signature>>;
};
```

**Machine context:**
```typescript
type MachineContext = {
  input: Input;
  buildContextResult?: AleoBuildContextResult;
  signature?: Signature;
  error?: AleoError;
};
```

**States:**
1. `OpenApp` — use existing `OpenAppDeviceAction("Aleo")`
2. `CheckTokenMetadata` — guard: if `input.tokenInternalId` is defined → transition to `BuildContext`; else → transition to `Sign`
3. `BuildContext` — invoke `BuildAleoTokenContextTask`, store result in context, transition to `ProvideContext` on success or `Error` on failure
4. `ProvideContext` — invoke `ProvideAleoTokenContextTask`, transition to `Sign` on success or `Error` on failure
5. `Sign` — invoke `SignRootIntentTask`, store signature, transition to `Success`
6. `Success` — terminal state, emits `Right(signature)`
7. `Error` — terminal state, emits `Left(error)`

**`MachineDependencies`** are passed at construction time (like Solana). The XState machine calls them; the outer `DeviceAction` class wires the real implementations using `InternalApi`.

### How to Test
**Create new file:**
`packages/signer/signer-aleo/src/internal/app-binder/device-action/SignRootIntent/__tests__/SignRootIntentDeviceAction.test.ts`

Reference: `packages/signer/signer-solana/src/internal/app-binder/device-action/__tests__/SignTransactionDeviceAction.test.ts`

Test cases:
1. Full flow WITH `tokenInternalId`: assert states transition OpenApp → CheckTokenMetadata → BuildContext → ProvideContext → Sign → Success
2. Flow WITHOUT `tokenInternalId`: assert CheckTokenMetadata skips directly to Sign (BuildContext and ProvideContext are never called)
3. `BuildContext` fails: assert machine ends in Error state with correct error, `ProvideContext` never called
4. `ProvideContext` fails: assert machine ends in Error state with correct error
5. Sign fails: assert machine ends in Error state
6. Assert final output type is `Either<AleoError, Signature>`
7. Assert `provideContext` is called with the result from `buildContext`

### Definition of Done
- [ ] XState machine with 5+ states is implemented
- [ ] `tokenInternalId` conditional branching works correctly
- [ ] Machine is exported and typed correctly
- [ ] Unit tests cover all state paths
- [ ] All tests pass
- [ ] `pnpm run signer-aleo build` compiles cleanly

---

## Task 11: Update AleoAppBinder

### What
Update `signRootIntent()` in `AleoAppBinder` to use the new `SignRootIntentDeviceAction` XState machine instead of the current `CallTaskInAppDeviceAction + SignRootIntentTask` pattern.

### Where
**Modify existing file:**
`packages/signer/signer-aleo/src/internal/app-binder/AleoAppBinder.ts`

### Reference
How `signer-solana`'s `SolanaAppBinder.ts` calls `SignTransactionDeviceAction`.

### Implementation Details

Current `signRootIntent` in `AleoAppBinder.ts` approximately looks like:
```typescript
signRootIntent(args: SignRootIntentTaskArgs): DeviceAction<Signature, ...> {
  return new CallTaskInAppDeviceAction({
    input: args,
    task: (internalApi) => new SignRootIntentTask(args).run(internalApi),
    appName: "Aleo",
    requiredUserInteraction: UserInteractionRequired.SignTransaction,
  });
}
```

Replace with:
```typescript
signRootIntent(args: SignRootIntentArgs): DeviceAction<Signature, ...> {
  return new SignRootIntentDeviceAction({
    input: args,
    // Pass MachineDependencies wired to the real context module
  });
}
```

The `ContextModule` must be available here. This requires Task 12 (DI wiring) to be done first, or at least the symbol to be injectable. If doing incrementally, keep the old path and add the new path behind an `if (args.tokenInternalId)` guard.

Also update the public API type `SignRootIntentDeviceActionTypes.ts`:
- File: `packages/signer/signer-aleo/src/api/app-binder/SignRootIntentDeviceActionTypes.ts`
- Add `tokenInternalId?: string` to the `Input` type

### How to Test
- Integration test: instantiate a mocked `ContextModule`, call `signRootIntent({ ..., tokenInternalId: "aleo_credits" })`, assert the device receives `LoadCertificateCommand` and `ProvideTokenInformationCommand` before `SignRootIntentCommand`
- Regression test: call `signRootIntent({ ... })` without `tokenInternalId`, assert only `SignRootIntentCommand` is sent (no certificate/token commands)

### Definition of Done
- [ ] `AleoAppBinder.signRootIntent` uses `SignRootIntentDeviceAction`
- [ ] `SignRootIntentDeviceActionTypes.ts` input type includes optional `tokenInternalId`
- [ ] Existing signing tests still pass (no regression)
- [ ] New integration tests pass

---

## Task 12: Wire ContextModule into signer-aleo DI

### What
Add `withContextModule()` to the public builder, pass the `ContextModule` through `DefaultSignerAleo` into `makeContainer()`, and bind it to the `externalTypes.ContextModule` symbol so it can be injected into tasks.

### Where
**Modify these existing files:**

| File | Change |
|------|--------|
| `packages/signer/signer-aleo/src/api/SignerAleoBuilder.ts` | Add `withContextModule(cm: ContextModule): this` method |
| `packages/signer/signer-aleo/src/internal/DefaultSignerAleo.ts` | Accept optional `contextModule` in constructor, pass to `makeContainer()` |
| `packages/signer/signer-aleo/src/internal/di.ts` | Accept `contextModule` in `MakeContainerProps`, bind it to `externalTypes.ContextModule` |

### Reference
- `packages/signer/signer-eth/src/api/SignerEthBuilder.ts` — `withContextModule()` method
- `packages/signer/signer-eth/src/internal/di.ts` — `contextModule` binding

### Implementation Details

**`SignerAleoBuilder.ts`** — add field and method:
```typescript
private _contextModule?: ContextModule;

withContextModule(contextModule: ContextModule): this {
  this._contextModule = contextModule;
  return this;
}

public build() {
  return new DefaultSignerAleo({
    dmk: this._dmk,
    sessionId: this._sessionId,
    contextModule: this._contextModule,
  });
}
```

**`DefaultSignerAleo.ts`** — add `contextModule` to constructor args and forward:
```typescript
type DefaultSignerAleoArgs = {
  dmk: DeviceManagementKit;
  sessionId: DeviceSessionId;
  contextModule?: ContextModule;
};

// In constructor:
this._container = makeContainer({ dmk, sessionId, contextModule });
```

**`di.ts`** — update `MakeContainerProps` and bind:
```typescript
export type MakeContainerProps = {
  dmk: DeviceManagementKit;
  sessionId: DeviceSessionId;
  contextModule?: ContextModule;  // optional — only needed for token metadata flow
};

// In makeContainer():
if (contextModule) {
  container
    .bind<ContextModule>(externalTypes.ContextModule)
    .toConstantValue(contextModule);
}
```

**Note on optional binding:** If `AleoTokenContextTask` injects `ContextModule`, it will throw at runtime if `contextModule` is not provided but `tokenInternalId` is passed. The XState machine should guard against this (transition to Error state if `tokenInternalId` is set but no `ContextModule` is bound).

### How to Test
1. Test that `SignerAleoBuilder.build()` works without `withContextModule()` (backwards compatible)
2. Test that `SignerAleoBuilder.withContextModule(mockCm).build()` returns a signer that uses the provided module
3. Check `DefaultSignerAleo` unit tests (if they exist) for constructor args

Also update `packages/signer/signer-aleo/src/index.ts` to re-export `ContextModule` if it's not already exported (users of the builder need to import it).

### Definition of Done
- [ ] `withContextModule()` is callable on `SignerAleoBuilder` and returns `this` (fluent)
- [ ] `ContextModule` is bound in the DI container when provided
- [ ] Calling without `withContextModule()` still works (no runtime error for non-token flows)
- [ ] Unit tests updated/added
- [ ] `pnpm run signer-aleo build` compiles cleanly

---

## Cross-Cutting: Changeset

After implementing the tasks, create a changeset for each modified package:

```sh
pnpm changeset
```

Packages that need changesets:
- `@ledgerhq/context-module` — minor (new `getAleoContext()` method)
- `@ledgerhq/signer-aleo` — minor (new `withContextModule()` builder method and optional `tokenInternalId` in sign input)

Reference: `.cursor/commands/changeset.md` for changeset conventions.

---

## Testing Summary

### Run All Tests
```sh
# Run signer-aleo tests
pnpm run signer-aleo test

# Run context-module tests (if test command differs, check package.json)
pnpm -F @ledgerhq/context-module test

# Build to check TypeScript
pnpm run signer-aleo build
```

### Test File Locations

| Task | Test File Location |
|------|-------------------|
| Task 3 | `context-module/src/aleoToken/data/__tests__/HttpAleoTokenDataSource.test.ts` |
| Task 4 | `context-module/src/aleoToken/domain/__tests__/AleoTokenContextLoader.test.ts` |
| Task 6 | `context-module/src/__tests__/DefaultContextModule.test.ts` (update existing) |
| Task 7 | `signer-aleo/src/internal/app-binder/command/__tests__/ProvideTokenInformationCommand.test.ts` |
| Task 8 | `signer-aleo/src/internal/app-binder/task/__tests__/BuildAleoTokenContextTask.test.ts` |
| Task 9 | `signer-aleo/src/internal/app-binder/task/__tests__/ProvideAleoTokenContextTask.test.ts` |
| Task 10 | `signer-aleo/src/internal/app-binder/device-action/SignRootIntent/__tests__/SignRootIntentDeviceAction.test.ts` |

---

## Key Reference Files Cheat-Sheet

| What you're implementing | Copy the pattern from |
|--------------------------|-----------------------|
| Token data source interface | `context-module/src/solanaToken/data/SolanaTokenDataSource.ts` |
| HTTP data source (CAL fetch) | `context-module/src/solanaToken/data/HttpSolanaTokenDataSource.ts` |
| Context loader (canHandle + loadField) | `context-module/src/solanaToken/domain/SolanaTokenContextLoader.ts` |
| DI symbol types | `context-module/src/solanaToken/di/tokenTypes.ts` |
| Module factory | `context-module/src/solanaToken/di/tokenModuleFactory.ts` |
| APDU token command | `signer-solana/src/internal/app-binder/command/ProvideTLVTransactionInstructionDescriptorCommand.ts` |
| Build context task | `signer-solana/src/internal/app-binder/task/BuildTransactionContextTask.ts` |
| Provide context task | `signer-solana/src/internal/app-binder/task/ProvideTransactionContextTask.ts` |
| XState signing machine | `signer-solana/src/internal/app-binder/device-action/SignTransactionDeviceAction.ts` |
| Builder withContextModule | `signer-eth/src/api/SignerEthBuilder.ts` |
| DI binding for ContextModule | `signer-eth/src/internal/di.ts` |
| PKI certificate loading | `context-module/src/pki/domain/PkiCertificateLoader.ts` |
