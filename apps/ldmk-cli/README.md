# Ledger Device Management Kit CLI

Interactive command-line interface for the [Ledger Device Management Kit](https://github.com/LedgerHQ/device-sdk-ts) (DMK). Use it to discover, connect to, and interact with Ledger devices from your terminal.

## Overview

The CLI provides a menu-driven workflow to:

- **Device management** — List Ledger devices, connect/disconnect
- **Device actions** — Open apps, list installed apps, go to dashboard
- **Low-level** — Send raw APDUs or structured device commands (OS version, battery, app info, etc.)
- **Signing** — Use the Ethereum signer for address derivation, message/transaction/typed-data signing, and Safe address verification

It uses `@ledgerhq/device-transport-kit-node-hid` transport kit and connects to the DMK DevTools for debugging.

## Prerequisites

- Node.js
- [proto](https://moonrepo.dev/docs/proto/install) and [pnpm](https://pnpm.io/) (see root [README](../../README.md))
- Dependencies installed from the **monorepo root**: `pnpm i`
- A Ledger device with USB support (for device commands)

## Dependencies

Key dependencies (workspace packages are from this monorepo):

| Package                                           | Purpose                                                                  |
| ------------------------------------------------- | ------------------------------------------------------------------------ |
| `@ledgerhq/device-management-kit`                 | Core DMK API: device discovery, connection, actions                      |
| `@ledgerhq/device-transport-kit-node-hid`         | USB HID transport for Ledger devices                                     |
| `@ledgerhq/device-signer-kit-ethereum`            | Ethereum app: address derivation, message/transaction/typed-data signing |
| `@ledgerhq/device-management-kit-devtools-*`      | DevTools logging and WebSocket connector (when using `pnpm dev`)         |
| `@ledgerhq/context-module`, `@ledgerhq/ldmk-tool` | Shared DMK utilities                                                     |

## Running the CLI

From the **repository root**:

```bash
pnpm cli dev
```

## Main commands

| Command                      | Description                                                                                               |
| ---------------------------- | --------------------------------------------------------------------------------------------------------- |
| **List devices**             | Discover available Ledger devices                                                                         |
| **Connect** / **Disconnect** | Connect to or disconnect from a selected device                                                           |
| **Send APDU**                | Send a raw APDU to the device                                                                             |
| **Send command**             | Run a device command: get OS version, app version, battery status, list/open/close apps                   |
| **Execute device action**    | Run high-level actions: device status, go to dashboard, open app, list apps, device metadata              |
| **Use signer**               | Use the Ethereum signer: get address, verify Safe address, sign message/transaction/typed data/delegation |
| **Exit**                     | Quit the CLI                                                                                              |

Available options depend on whether a device is connected; the menu updates accordingly.

## Project structure

```
apps/ldmk-cli/
├── index.ts                 # Entry point, bootstraps DI and runs FrontController
├── app/
│   ├── di/                  # Inversify module and types
│   ├── FrontController.ts   # Main loop: device listener, prompt, action dispatch
│   ├── state/               # App state (discovered devices, connection)
│   ├── handlers/            # Action handlers (one per user-facing command)
│   │   ├── device/          # List, connect, disconnect
│   │   ├── apdu/            # Send raw APDU
│   │   ├── device-command/  # Send device commands (OS version, apps, etc.)
│   │   ├── device-action/   # High-level device actions
│   │   ├── signer/          # Signer selection and Eth signer sub-actions
│   │   └── cli/             # Exit
│   └── utils/
└── package.json
```

## Handler architecture (strategy pattern)

The CLI uses the **strategy pattern** for all user-facing commands. Handlers are interchangeable implementations of a common interface: each has a `type`, a `description`, a `supports(type)` method to match user selection, and a `handle()` method that runs the command.

- **Front controller** — The main loop (`FrontController`) holds a list of **CLI action handlers** (`ActionHandler`). It shows a menu built from their `description`, and when the user picks an option it finds the handler for that `type` via `supports()` and calls `handle()`.
- **Nested strategies** — Some CLI actions open a sub-menu and dispatch to another set of handlers in the same way:
  - **Send command** → list of `DeviceCommandHandler` (e.g. get OS version, list apps).
  - **Execute device action** → list of `DeviceActionHandler` (e.g. open app, device status).
  - **Use signer** → list of `SignerActionHandler` (e.g. ETH signer); choosing a signer can then show **signer-specific handlers** (e.g. `EthSignerActionHandler`: get address, sign transaction).

So at every level: **many handlers registered by type → user chooses by description → one handler is selected with `supports()` → `handle()` runs**. No `switch` on action type; adding a new command means adding a new handler class and registering it in the DI container (`app/di/app.module.ts`).

---

## How to extend the CLI

### Add a new CLI action

A CLI action is a top-level menu entry (e.g. "List devices", "Send command", "Exit").

1. **Extend the action enum** — In `app/handlers/ActionType.ts`, add a new value to `ActionTypes` (e.g. `MY_ACTION = "my-action"`).
2. **Implement the handler** — Create a class that implements `ActionHandler`:
   - `type`: your new `ActionTypes` value
   - `description`: short label for the menu
   - `connectionMode`: `ConnectionMode.CONNECTED`, `DISCONNECTED`, or `BOTH`
   - `supports(action)`: return `action === this.type`
   - `handle()`: run your logic; return `true` to exit the main loop, `false` to stay in the menu
3. **Register in DI** — In `app/di/app.module.ts`, add:
   - `bind(appTypes.ActionHandler).to(YourActionHandler)`

Example: `ExitActionHandler`, `ListDevicesActionHandler`.

---

### Add a new device command

Device commands are the options under **Send command** (e.g. get OS version, close app). They send a single command to the device via `dmkInstance.sendCommand()`.

1. **Extend the command enum** — In `app/handlers/device-command/handlers/DeviceCommandType.ts`, add a value to `DeviceCommandTypes`.
2. **Implement the handler** — Create a class that implements `DeviceCommandHandler`:
   - `type`: your new `DeviceCommandTypes` value
   - `description`: label shown in the "Select a command" menu
   - `supports(type)`: return `type === this.type`
   - `handle()`: get `sessionId` from `appState.getDeviceSessionId()`, call `dmkInstance.sendCommand({ sessionId, command: new YourCommand() })`, then display the result (e.g. with `chalk`). Return `true` to exit the command sub-loop, `false` to show the menu again.
3. **Register in DI** — In `app/di/app.module.ts`, add:
   - `bind(appTypes.DeviceCommandHandler).to(YourCommandHandler)`

Use the DMK command types from `@ledgerhq/device-management-kit` (e.g. `GetOsVersionCommand`) or define your own if needed. Example: `GetOsVersionCommandHandler`.

---

### Add a new device action

Device actions are the options under **Execute device action** (e.g. open app, device status). They use `dmkInstance.executeDeviceAction()`, which returns an observable and can show pending/complete/error states.

1. **Extend the action enum** — In `app/handlers/device-action/handlers/DeviceActionType.ts`, add a value to `DeviceActionTypes`.
2. **Implement the handler** — Create a class that **extends** `BaseDeviceActionHandler<Output, Error, IntermediateValue>` (from `app/handlers/device-action/handlers/BaseDeviceActionHandler.ts`):
   - `type`: your new `DeviceActionTypes` value
   - `description`: label in the device action menu
   - `supports(type)`: return `type === this.type`
   - `getObservable()`: call `this.dmkInstance.executeDeviceAction({ sessionId: this.appState.getDeviceSessionId()!, deviceAction: new YourDeviceAction(...) })` and return the `observable`
   - `displayOutput(output)`: log the result to the user (e.g. with `chalk`)
3. **Register in DI** — In `app/di/app.module.ts`, add:
   - `bind(appTypes.DeviceActionHandler).to(YourDeviceActionHandler)`

Use the DMK device action types from `@ledgerhq/device-management-kit` (e.g. `GetDeviceStatusDeviceAction`). Example: `GetDeviceStatusDeviceActionHandler`.

---

### Add a new signer

Adding a new signer (e.g. Solana) adds a new option under **Use signer** and its own sub-menu of signer-specific actions.

1. **Extend the signer enum** — In `app/handlers/signer/handlers/SignerType.ts`, add a value to `SignerTypes` (e.g. `SOLANA_SIGNER = "solana-signer"`).
2. **Add a signer action handler interface and type** — Under `app/handlers/signer/handlers/<your-signer>/`:
   - Define an enum for this signer’s actions (e.g. `SolanaSignerActionTypes`) and an interface (e.g. `SolanaSignerActionHandler`) with `type`, `description`, `supports(type)`, `handle()`.
3. **Add a DI symbol** — In `app/di/app.types.ts`, add a symbol for the new signer’s handlers (e.g. `SolanaSignerActionHandler`).
4. **Implement the signer entry handler** — A class implementing `SignerActionHandler` (like `UseEthSignerActionHandler`):
   - `type`: your new `SignerTypes` value
   - `description`: e.g. "Use a Solana Signer"
   - `supports(type)`: return `type === this.type`
   - `handle()`: run a loop that shows a menu of your signer’s actions, then uses `multiInject(yourSignerActionHandlerSymbol)` to find the right handler with `supports()` and call `handle()`.
5. **Implement each signer action** — For each action (e.g. get address, sign transaction), create a handler implementing your signer action interface (or extend a base class if you add one, similar to `BaseEthSignerActionHandler`).
6. **Register in DI** — In `app/di/app.module.ts`:
   - `bind(appTypes.SignerActionHandler).to(UseYourSignerActionHandler)`
   - For each concrete action: `bind(appTypes.YourSignerActionHandler).to(YourSignerActionHandlerClass)`

Reference implementation: `UseEthSignerActionHandler` and the `eth-signer` handlers under `app/handlers/signer/handlers/eth-signer/`.

---

### Add a new signer action

Add a new option to an existing signer’s sub-menu (e.g. a new Ethereum signer action).

1. **Extend the signer action enum** — In that signer’s folder, e.g. `app/handlers/signer/handlers/eth-signer/handlers/EthSignerActionType.ts`, add a value to `EthSignerActionTypes`.
2. **Implement the handler** — Create a class that **extends** the signer’s base handler if there is one (e.g. `BaseEthSignerActionHandler<Output, Error, IntermediateValue>`):
   - `type`: your new action type value
   - `description`: label in the signer action menu
   - `supports(type)`: return `type === this.type`
   - `getObservable()`: build the signer (e.g. `SignerEthBuilder`), call the appropriate method (e.g. `getAddress`, `signTransaction`), return the observable
   - `displayOutput(output)`: log the result
   - Override `handle()` to collect input (e.g. derivation path) before calling `super.handle()` if needed.
3. **Register in DI** — In `app/di/app.module.ts`, add:
   - `bind(appTypes.EthSignerActionHandler).to(YourEthSignerActionHandler)` (or the matching symbol for that signer)

Example: `GetAddressEthSignerActionHandler`, `SignTransactionEthSignerActionHandler`.
