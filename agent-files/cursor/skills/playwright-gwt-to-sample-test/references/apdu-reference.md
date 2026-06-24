# APDU reference for sample Playwright tests

Use when the spec describes APDU mocking in natural language. Prefer explicit hex from the author when provided.

**Authoritative source:** [Ledger OS – APDU commands](https://ledgerhq.atlassian.net/wiki/spaces/FW/pages/4455596105/Ledger+OS+-+APDU+commands) (Confluence). Search via Atlassian MCP when this cheat sheet is insufficient.

**Code fallback:** `packages/device-management-kit/src/api/command/**/{Name}Command.ts` → `getApdu()`.

## Prefix format

Mock server `prefix` is the command APDU as **lowercase hex, no spaces**: `cla + ins + p1 + p2 + [Lc + data…]`.

For commands with **variable data** (e.g. Open app includes app name), the prefix must include the data bytes or match a leading substring — check Confluence or existing tests.

Fixed-prefix commands (no data in header):

| Command          | CLA    | INS    | P1     | P2     | Prefix     |
| ---------------- | ------ | ------ | ------ | ------ | ---------- |
| GetAppAndVersion | `0xb0` | `0x01` | `0x00` | `0x00` | `b0010000` |
| GetOsVersion     | `0xe0` | `0x01` | `0x00` | `0x00` | `e0010000` |
| CloseApp         | `0xb0` | `0xa4` | `0x00` | `0x00` | `b0a40000` |

OpenApp (`cla=0xe0, ins=0xd8`) includes ASCII app name in data — prefix varies per app.

## Common status words

| Hex    | Meaning                    | Sample usage                                                 |
| ------ | -------------------------- | ------------------------------------------------------------ |
| `9000` | Success                    | Trailing SW of full response payloads                        |
| `5515` | Device locked              | `sidebar.expectStatus("LOCKED")`, GetAppAndVersion refresher |
| `6985` | User refused               | User rejection on device                                     |
| `6807` | Unknown application        | Open app not installed (`OpenAppCommandError`)               |
| `670a` | Wrong length / no app name | Open app with empty name                                     |

For **error-only mocks** in existing tests, a short status word alone is often enough (e.g. `response: "5515"`).

## Full response payloads

Some tests use complete response hex (data + status word). Example from `get-os-version_error-sequence_nano-x.spec.ts`:

```ts
const OK_RESPONSE =
  "3300000405322e322e3304e600000004322e333004312e31360100010001009000";
const ERROR_RESPONSE = "5515";
```

Use full payloads when the command parser expects structured data before the status word. Use status-word-only when simulating a bare failure.

## Mock patterns in existing tests

### Single override (device locked via refresher)

```ts
await mockClient.addMock(dev.id, {
  prefix: "b0010000",
  response: "5515",
});
```

GetAppAndVersion is polled ~1s by the device-session refresher — overriding it changes sidebar status without executing a command.

### Response sequence (loops)

```ts
await mockClient.addMock(dev.id, {
  prefix: "e0010000",
  responses: [OK_RESPONSE, OK_RESPONSE, "5515"],
});
```

Each Send of Get OS version consumes the next entry; sequence loops when exhausted.

### Override over live Speculos proxy

Explicit mocks take precedence over the Speculinho proxy when an app is open. See `mock-overrides-speculos.spec.ts`.

## Natural language → resolution

| Spec phrase                       | Resolution                                                                                    |
| --------------------------------- | --------------------------------------------------------------------------------------------- |
| "device locked" / "5515"          | `response: "5515"` on GetAppAndVersion (`b0010000`) for status; or bare SW for command errors |
| "GetAppAndVersion returns locked" | prefix `b0010000`, response `5515`                                                            |
| "GetOsVersion fails on Nth call"  | prefix `e0010000`, `responses` array with OK entries then error                               |
| "unknown application" / "6807"    | Open app error — usually no mock needed if app not in `DeviceConfig.apps`                     |

When the spec names a DMK command (e.g. `GetOsVersionCommand`), grep the codebase for `class {Name}Command` and read `getApdu()`.
