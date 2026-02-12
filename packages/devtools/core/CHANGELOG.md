# @ledgerhq/device-management-kit-devtools-core

## 1.1.0

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

### Patch Changes

- [#1289](https://github.com/LedgerHQ/device-sdk-ts/pull/1289) [`359abd7`](https://github.com/LedgerHQ/device-sdk-ts/commit/359abd78a427b93a470fa9ff56200dbc2e444111) Thanks [@OlivierFreyssinet](https://github.com/OlivierFreyssinet)! - Devtools improvements: add status badges and collapsible components to inspector, move connect options into discovered device cards, pass session refresher options through connect flow, invert APDU response display order, and add files field to rozenite package.json.

- Updated dependencies [[`974e0f8`](https://github.com/LedgerHQ/device-sdk-ts/commit/974e0f8789d711e3be8966d4b19f3128bf70bb28), [`974e0f8`](https://github.com/LedgerHQ/device-sdk-ts/commit/974e0f8789d711e3be8966d4b19f3128bf70bb28), [`c97b5c0`](https://github.com/LedgerHQ/device-sdk-ts/commit/c97b5c08f7d096e8c2a1c1ec8140fe47379d6289), [`b63acfa`](https://github.com/LedgerHQ/device-sdk-ts/commit/b63acfad259df50e824b8eab08d305eed1b0f888), [`0031856`](https://github.com/LedgerHQ/device-sdk-ts/commit/0031856a68ad10a461bbefe43d134a897c736ef2), [`80f7372`](https://github.com/LedgerHQ/device-sdk-ts/commit/80f737276d5e9a3cda58e548f454fa2114384efd), [`974e0f8`](https://github.com/LedgerHQ/device-sdk-ts/commit/974e0f8789d711e3be8966d4b19f3128bf70bb28)]:
  - @ledgerhq/device-management-kit@1.1.0
