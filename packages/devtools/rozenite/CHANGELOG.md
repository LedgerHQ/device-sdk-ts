# @ledgerhq/device-management-kit-devtools-rozenite

## 0.1.0

### Minor Changes

- [#1251](https://github.com/LedgerHQ/device-sdk-ts/pull/1251) [`a73bc9f`](https://github.com/LedgerHQ/device-sdk-ts/commit/a73bc9f661377a0a5f9c4794dc9fe13b0102d0ca) Thanks [@OlivierFreyssinet](https://github.com/OlivierFreyssinet)! - Add DevToolsDmkInspector for device session inspection and control

  **devtools-core:**

  - New `DevToolsDmkInspector` module enabling bi-directional communication between client app and dashboard
  - Device discovery: passive listening and active discovery from the dashboard
  - Device session actions: disconnect sessions, send raw APDU commands
  - DMK configuration: view and set Manager API provider
  - Exports command types and message types for type-safe communication

  **devtools-ui:**

  - New Inspector screen with device sessions list and live state updates
  - Device discovery UI with listening/discovering controls
  - APDU sender for debugging raw device communication
  - Split view mode to display Logger and Inspector side-by-side with draggable divider
  - Debug drawer for raw message inspection
  - Navigation bar with tabs for Logger, Inspector, and split modes

  **devtools-rozenite:**

  - Fix bidirectional handshake to ensure messages flow correctly regardless of initialization order

- [#1282](https://github.com/LedgerHQ/device-sdk-ts/pull/1282) [`3caa949`](https://github.com/LedgerHQ/device-sdk-ts/commit/3caa94989ba98c27e3c59dd93735d9075802a834) Thanks [@OlivierFreyssinet](https://github.com/OlivierFreyssinet)! - Add setVerbose method to connector implementations to enable/disable console logging

### Patch Changes

- [#1289](https://github.com/LedgerHQ/device-sdk-ts/pull/1289) [`359abd7`](https://github.com/LedgerHQ/device-sdk-ts/commit/359abd78a427b93a470fa9ff56200dbc2e444111) Thanks [@OlivierFreyssinet](https://github.com/OlivierFreyssinet)! - Devtools improvements: add status badges and collapsible components to inspector, move connect options into discovered device cards, pass session refresher options through connect flow, invert APDU response display order, and add files field to rozenite package.json.

- Updated dependencies [[`a73bc9f`](https://github.com/LedgerHQ/device-sdk-ts/commit/a73bc9f661377a0a5f9c4794dc9fe13b0102d0ca), [`359abd7`](https://github.com/LedgerHQ/device-sdk-ts/commit/359abd78a427b93a470fa9ff56200dbc2e444111), [`58831d8`](https://github.com/LedgerHQ/device-sdk-ts/commit/58831d8bb67c3bed4de4cb6b43e968f76c3cbeb6)]:
  - @ledgerhq/device-management-kit-devtools-core@2.0.0
  - @ledgerhq/device-management-kit-devtools-ui@2.0.0
