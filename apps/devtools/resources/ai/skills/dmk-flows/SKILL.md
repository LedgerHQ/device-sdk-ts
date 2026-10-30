---
name: dmk-flows
description: How the Ledger Device Management Kit (DMK) drives a device - sessions, polling, device actions, signers - and the failures that show up in its logs. Use to explain what DMK was doing around a set of APDU exchanges.
---

# DMK flows

## Sessions and polling

- An app connects to a device and gets a **session** (a session id appears in the logs and in each APDU exchange).
- While a session is idle, DMK's refresher sends `getAppAndVersion` (`b001`) about every second (every two on a Nano). The answer tells which app is open (`BOLOS` = dashboard) and drives the device status: connected, locked (`5515`), busy.
- While a command or device action runs, polling pauses, so the app cannot change without the user acting on the device.
- An app can also send APDUs directly (`sendApdu`), as Ledger Live does: those exchanges appear without a DMK command name around them.

## Device actions

A device action is a state machine that chains commands and waits for the user. Its logs show state transitions and, at the end, a success or an error.

- **Open app**: `getAppAndVersion`; when another app is open, `closeApp` (`b0a7`) and back to the dashboard; then `openApp` (`e0d8` + app name). On USB the device may disconnect and reconnect while the app starts. Errors: `6807` (not installed), `5501` (user refused), `5515` (locked: DMK waits for the unlock until a timeout).
- **Signers** (Ethereum, Solana, Bitcoin, …) open their app, read its configuration, provide context the device needs to display the operation (token or NFT information, trusted names, transaction descriptors), then send the payload in chunks. The first chunk and the next ones usually differ only by P1. The signature comes back with the last chunk.
- **Clear signing** depends on that context: when it is missing or rejected, the app falls back to blind signing, which the user may have disabled or refused.
- **Secure channel** operations (genuine check, app install, firmware update) relay APDUs between a Ledger backend and the device over a WebSocket.

## What failures look like

| In the logs | Usually |
|-------------|---------|
| `5515` on a poll, status locked | The user has not unlocked the device. |
| `5501` or `6985` right after a screen was shown | The user rejected on the device. |
| `6e00` / `6d00` | A command reached the wrong app, or the app is too old. |
| `6a80` while providing context | The descriptor or payload format did not match the app version. |
| A request with no response, then a disconnect | The device was unplugged, went to sleep, or the app crashed. |
| `getAppAndVersion` naming another app mid-flow | The user left the app on the device. |
