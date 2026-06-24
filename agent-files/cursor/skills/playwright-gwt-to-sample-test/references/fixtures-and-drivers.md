# Fixtures and drivers

Defined in `apps/sample/playwright/fixtures.ts`. Fixtures are lazy — requesting `mockClient` (directly or via `device`) provisions a mock-server session.

## Fixture map

| Fixture      | Type                         | Use when                                   |
| ------------ | ---------------------------- | ------------------------------------------ |
| `mockClient` | `MockClient`                 | APDU mocks, session lifecycle              |
| `device`     | `MockDeviceDriver`           | Add/connect mocked devices                 |
| `commands`   | `CommandsDriver`             | OS commands view (`/commands`)             |
| `ethSigner`  | `EthSignerDriver`            | Ethereum signer actions                    |
| `btcSigner`  | `BtcSignerDriver`            | Bitcoin signer actions                     |
| `sidebar`    | `SidebarDriver`              | Device session status (CONNECTED, LOCKED…) |
| `settings`   | `SettingsDriver`             | Settings view assertions                   |
| `speculos`   | `(device) => SpeculosDriver` | On-device screen interactions              |
| `page`       | Playwright `Page`            | Direct navigation (settings)               |

## MockDeviceDriver

| Method                  | Description                                           |
| ----------------------- | ----------------------------------------------------- |
| `add(config)`           | Attach device to session, returns `Device`            |
| `connect(transport?)`   | Open app, select MOCKSERVER transport, wait CONNECTED |
| `addAndConnect(config)` | `add` + `connect`, returns `Device`                   |

## CommandsDriver

| Method                          | Description                      |
| ------------------------------- | -------------------------------- |
| `goto()`                        | Navigate to `/commands`          |
| `execute(command, params?)`     | Open drawer, fill inputs, send   |
| `open(command)`                 | Open drawer without sending      |
| `send()`                        | Click Send on open drawer        |
| `closeDrawer()`                 | Dismiss open command drawer      |
| `waitForResponseCount(n)`       | Wait for n responses in list     |
| `lastResponse<T>({ timeout? })` | Parse last command response JSON |

**Params shape:** `{ inputField: "input-text_{name}", inputValue: "…" }` or array of same.

**Known commands** (UI label → `execute` argument):

- `"Get OS version"`
- `"Get app and version"`
- `"Open app"` (params: `input-text_appName`)

## EthSignerDriver

| Method                                    | Description                     |
| ----------------------------------------- | ------------------------------- |
| `open()`                                  | Navigate to `/signers/ethereum` |
| `getAddress({ checkOnDevice? })`          | Run Get address action          |
| `signTransaction(tx, { skipOpenApp? })`   | Run Sign transaction            |
| `signTypedMessage(msg, { skipOpenApp? })` | Run Sign typed message          |
| `lastResult<Output>({ timeout? })`        | Parse last device-action state  |

## BtcSignerDriver

| Method                                     | Description                    |
| ------------------------------------------ | ------------------------------ |
| `open()`                                   | Navigate to `/signers/bitcoin` |
| `getExtendedPublicKey({ checkOnDevice? })` | Run Get extended public key    |
| `lastResult<Output>({ timeout? })`         | Parse last device-action state |

## SidebarDriver

| Method                               | Description                |
| ------------------------------------ | -------------------------- |
| `expectStatus(status, { timeout? })` | Assert session status text |

Status values: `"CONNECTED"`, `"LOCKED"`, `"BUSY"`, `"NOT CONNECTED"`.

## SpeculosDriver

Constructed via `speculos(dev)` after `dev = await device.addAndConnect(…)`.

| Method                      | Description                                            |
| --------------------------- | ------------------------------------------------------ |
| `waitReady({ timeoutMs? })` | Wait for Speculos instance, start screen log           |
| `approve()`                 | Approve simple on-device confirm (e.g. address verify) |
| `approveSigning()`          | Navigate review screens and hold-to-sign               |
| `enableBlindSigning()`      | Enable blind signing in Ethereum app settings          |
| `attachScreenshot(label)`   | Attach screenshot to test report (auto on teardown)    |

## SettingsDriver

| Method                           | Description                            |
| -------------------------------- | -------------------------------------- |
| `expectSessionTokenInput(value)` | Assert mock server session token input |

## Response shape reference

**Command response** (`commands.lastResponse`):

```ts
{ status: "SUCCESS" | "ERROR" | "PENDING"; data?: …; error?: { _tag; errorCode; message } }
```

**Device action result** (`ethSigner.lastResult` / `btcSigner.lastResult`):

```ts
{ status: "completed" | "error" | "pending"; output?: …; error?: … }
```
