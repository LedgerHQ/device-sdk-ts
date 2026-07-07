---
name: playwright-gwt-to-sample-test
description: >
  Converts a human-written GIVEN / WHEN / THEN specification into a Playwright
  end-to-end test for the DMK sample app (apps/sample/playwright/). Use whenever
  the user pastes or writes a GWT scenario, asks to "turn this spec into a
  Playwright test", "add a sample e2e test for…", or describes sample-app
  behavior in Given/When/Then form. Also trigger when writing mock-server APDU
  tests, Speculos interaction tests, or device-command / signer flows in the
  sample app — even if the user does not mention Playwright explicitly.
---

# Playwright GWT → Sample Test

Generate Playwright specs for `apps/sample/playwright/` from strict **GIVEN / WHEN / THEN**
scenarios. One scenario per input.

Read `references/patterns.md` before generating code — it has templates per test family.
Read `references/fixtures-and-drivers.md` to pick fixtures and existing driver methods.
Read `references/apdu-reference.md` when the spec involves APDU mocking.

## Step 1: Parse the spec

Expect exactly these blocks (case-insensitive keywords, one line or paragraph each):

```
GIVEN …
WHEN …
THEN …
```

- `AND` lines belong to the preceding block (e.g. an `AND` after `WHEN` is part of WHEN).
- Multiple `WHEN` / `THEN` pairs are allowed for multi-step scenarios (see existing tests).
- If a block is missing or the format is ambiguous, ask before generating.

## Step 2: Gather requirements

Do **not** proceed without the following. Ask the user if anything is missing:

| Required                        | Why                                                               |
| ------------------------------- | ----------------------------------------------------------------- |
| Device model and installed apps | Build `DeviceConfig` (see `references/device-configs.md`)         |
| Command or signer action name   | Pick driver and navigation                                        |
| Expected values in THEN steps   | Addresses, signatures, error codes, status text — **never guess** |
| APDU details (if mocking)       | Explicit hex or command name + desired outcome                    |

The author must provide assertion values. Do not invent addresses, signatures, xpubs, or error payloads.

## Step 3: Classify the test and pick output path

| Signals in spec                                             | Fixtures                          | Output folder             |
| ----------------------------------------------------------- | --------------------------------- | ------------------------- |
| OS command (Get OS version, Open app, Get app and version…) | `device`, `commands`              | `cases/device/command/`   |
| Device status, APDU override, locked device                 | `device`, `mockClient`, `sidebar` | `cases/device/`           |
| Ethereum signer action                                      | `device`, `ethSigner`             | `cases/signers/ethereum/` |
| Bitcoin signer action                                       | `device`, `btcSigner`             | `cases/signers/bitcoin/`  |
| Settings UI                                                 | `page`, `mockClient`, `settings`  | `cases/settings/`         |
| On-device approval / Speculos screen                        | add `speculos`                    | same as signer/command    |

File naming: `{feature}.spec.ts` or `{feature}_{variant}_{device}.spec.ts`.

## Step 4: Resolve APDU mocks

When the spec mentions mocking an APDU response:

1. **Explicit hex in spec** — use as-is (`prefix`, `response`, or `responses` array).
2. **Natural language** — resolve in order:
   - `references/apdu-reference.md` (common commands and status words)
   - Confluence: [Ledger OS – APDU commands](https://ledgerhq.atlassian.net/wiki/spaces/FW/pages/4455596105/Ledger+OS+-+APDU+commands) via Atlassian MCP / `search-company-knowledge`
   - DMK source: `packages/device-management-kit/src/api/command/**/{Name}Command.ts` → read `getApdu()` for `cla/ins/p1/p2`, encode as lowercase hex prefix (no spaces)
3. If still unclear, ask the user for the hex prefix and response.

Mock API (`mockClient.addMock`):

```ts
// Single response
await mockClient.addMock(dev.id, { prefix: "b0010000", response: "5515" });

// Response sequence (loops when exhausted)
await mockClient.addMock(dev.id, {
  prefix: "e0010000",
  responses: [OK, OK, ERROR],
});

// Remove override
await mockClient.deleteMock(dev.id, mockId);
```

When mocks must exist **before** the app connects, use `device.add()` → `addMock()` → `device.connect()` instead of `addAndConnect()`.

## Step 5: Generate the `.spec.ts`

Follow `references/patterns.md`. Key rules:

- Preserve the author's GIVEN/WHEN/THEN wording in `test.step()` titles (light normalization only).
- One `test()` per scenario inside a `test.describe("{domain}: {feature}")`.
- Co-locate response/output interfaces in the spec file.
- Add `/* eslint-disable no-restricted-imports */` at the top.
- Import `test` (and `expect` when asserting) from the correct relative `fixtures` path.
- Use `test.setTimeout(120_000)` when Speculos is involved (installed app open, on-device approval).
- Store `dev` when later steps need `dev.id` (mocks, Speculos).
- Comments only for non-obvious mock rationale — match existing test style.

## Step 6: Extend drivers when needed

If the WHEN step references an action with no driver method yet, read
`references/driver-extension-guide.md` and add the method to the appropriate
`*Driver.ts` in `apps/sample/playwright/utils/drivers/`.

Do **not** modify the sample React app. If a `data-testid` may be missing, add a
`// TODO: requires CTA_command-{label} in sample app` comment in the driver method.

## Step 7: Sanity checklist

Before finishing, verify:

- [ ] Correct `fixtures` import depth for the target folder
- [ ] `mockClient` fixture used whenever `addMock` / `deleteMock` is called
- [ ] `test.setTimeout(120_000)` for Speculos flows
- [ ] All expected values come from the spec, not invented
- [ ] Typed generics on `lastResponse<T>()` / `lastResult<T>()`
- [ ] `dev` captured when `dev.id` is needed later

## Examples

See `examples/` for full input → output walkthroughs:

- `examples/command-gwt-to-spec.md` — OS command, no APDU mock
- `examples/signer-gwt-to-spec.md` — signer action with Speculos approval
- `examples/apdu-mock-gwt-to-spec.md` — APDU mock + sidebar status
