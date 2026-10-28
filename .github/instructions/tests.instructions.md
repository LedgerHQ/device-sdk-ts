---
applyTo: "**/*.test.ts,**/*.test.tsx"
---

# Tests (Vitest)

- Vitest runs with `globals: true`, so `describe`, `it`, `expect` and `vi` don't need to be imported.
- Test files sit next to the source (`Foo.ts` → `Foo.test.ts`). Shared helpers live in `__test-utils__/`, `__mocks__/`, `__fixtures__/` and `*.stub.ts`.
- Mocks use `vi.fn()` / `vi.mock()`, and DI-bound services are stubbed with `*.stub.ts` factories. Prefer the existing stubs and `__test-utils__/` helpers over new ad-hoc mocks.

## Expected patterns per layer

`signer-eth` and `packages/device-management-kit/src/api/device-action/os/` are the references.

- **Commands:**
  - `getApdu` compares `getRawApdu()` with the exact expected bytes for each argument variant (flags, optional fields, chunking).
  - `parseResponse` covers the success case, a non-`9000` status word (mapped to the app error), and each malformed-payload branch (bad length, missing field).
- **Tasks:**
  - Stub the replies with `sendCommand.mockResolvedValueOnce(...)` on an internal API mock (`makeDeviceActionInternalApiMock` from `__test-utils__/`).
  - Assert the command sequence (`toHaveBeenNthCalledWith`, `toHaveBeenCalledTimes`).
  - Check that a failing intermediate command stops the task and returns its error.
- **Device actions:**
  - Drive the machine with `testDeviceActionStates` and the `__test-utils__/` mocks (`setupOpenAppDAMock`, `makeDeviceActionInternalApiMock`).
  - Assert the full emitted state sequence, including the error paths.
- **App binders:** assert that `dmk.executeDeviceAction` is called with the right DA and input (`appName`, `requiredUserInteraction`, the command or task), and that its states are passed through unchanged.

## Review focus

- Tests assert behavior: an `Either`'s left/right, emitted states, APDU bytes. A test that only checks a mock was called is not enough.
- No real network, device or timer dependency: use fake timers and mocked transports.

## Do not flag

- `any`, `as unknown as X`, non-null assertions, `eslint-disable` for `no-explicit-any` / `no-unsafe-*`. They are tolerated in tests.
- Node globals (`Buffer`, `process`) in tests: the portable-runtime ban doesn't apply to test files.
- Long fixture arrays or hex strings.
- Repetition between test cases (readability over DRY).
