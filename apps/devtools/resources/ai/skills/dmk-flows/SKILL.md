---
name: dmk-flows
description: How DMK drives a Ledger device - sessions, polling, device actions, signers, clear signing - and how it shows in the logs. Use to explain what DMK did around the APDUs.
---

# DMK flows

## Sessions

- Connecting gives a session; its id is in the logs and on each exchange.
- While idle, DMK polls `getAppAndVersion` (`b001`) every second, every two on a Nano. The answer gives the open app (`BOLOS` is the dashboard) and the device status: connected, locked (`5515`), busy.
- Polling pauses while a command or device action runs, so the open app changes only if the user acts on the device.
- Exchanges sent with `sendApdu`, as Ledger Live does, have no DMK command around them.

## Device actions

State machines that chain commands and wait for the user; the logs show state transitions, then a success or an error.

- **Open app**: `getAppAndVersion`; if another app is open, `closeApp` (`b0a7`); then `openApp` (`e0d8` and the name). On USB the device may disconnect and reconnect while the app starts. On `5515` DMK waits for the unlock until a timeout.
- **Signers** open their app, read its configuration, provide what the device needs to display the operation (token or NFT information, trusted names, descriptors), then send the payload in chunks. Chunks usually differ only by P1; the signature comes with the last one.
- **Clear signing** needs that context. When it is missing or rejected, the app falls back to blind signing, which the user may have disabled or refuse.
- **Secure channel** operations (genuine check, app install, firmware update) relay APDUs between a Ledger backend and the device over a WebSocket.

## Failures without a status word

- A request with no response, then a disconnect: unplugged, asleep, or the app crashed.
- `getAppAndVersion` naming another app mid-flow: the user left the app on the device.
- A timeout while waiting for the user: the user did not act.
