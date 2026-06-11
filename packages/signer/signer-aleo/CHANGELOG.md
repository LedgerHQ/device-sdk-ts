# Changelog

## 0.4.0

### Minor Changes

- [#1545](https://github.com/LedgerHQ/device-sdk-ts/pull/1545) [`407aa67`](https://github.com/LedgerHQ/device-sdk-ts/commit/407aa67c4879071fee6ce7f49925ccf3754c64f5) Thanks [@0xMM-L](https://github.com/0xMM-L)! - Add GET_TVK command (INS=0x08) to retrieve transition view keys from the device, supporting both root (P1=0x00) and indexed (P1=0x01) modes as specified in ADR005.

## 0.3.0

### Minor Changes

- [#1478](https://github.com/LedgerHQ/device-sdk-ts/pull/1478) [`cd782f8`](https://github.com/LedgerHQ/device-sdk-ts/commit/cd782f85bf8265d407450f896f871ad093e87751) Thanks [@0xMM-L](https://github.com/0xMM-L)! - Add support for signing nested calls

### Patch Changes

- Updated dependencies [[`95d1bf8`](https://github.com/LedgerHQ/device-sdk-ts/commit/95d1bf8ea5a122dbb46573dea0b7fb315de8bbfb), [`5da4263`](https://github.com/LedgerHQ/device-sdk-ts/commit/5da4263bf6fa73a5803663a8ba0745a7368d4e36)]:
  - @ledgerhq/context-module@2.0.0
  - @ledgerhq/device-management-kit@1.5.0

## 0.2.0

### Minor Changes

- [#1328](https://github.com/LedgerHQ/device-sdk-ts/pull/1328) [`e80f1fb`](https://github.com/LedgerHQ/device-sdk-ts/commit/e80f1fb3f9667e2768f6e235d311924d8b516cbf) Thanks [@0xMM-L](https://github.com/0xMM-L)! - Add aleo-signer module with get app config command support

- [#1330](https://github.com/LedgerHQ/device-sdk-ts/pull/1330) [`318500d`](https://github.com/LedgerHQ/device-sdk-ts/commit/318500d983701b02816592e246e9257d57fc02a7) Thanks [@0xMM-L](https://github.com/0xMM-L)! - Add support for get view key command

- [#1329](https://github.com/LedgerHQ/device-sdk-ts/pull/1329) [`202bd18`](https://github.com/LedgerHQ/device-sdk-ts/commit/202bd18127e471b541c9250132a2190214727f03) Thanks [@0xMM-L](https://github.com/0xMM-L)! - Add support for get address command

- [#1337](https://github.com/LedgerHQ/device-sdk-ts/pull/1337) [`7fb034e`](https://github.com/LedgerHQ/device-sdk-ts/commit/7fb034e7c397123893af5f7ed49caf655d9a1586) Thanks [@0xMM-L](https://github.com/0xMM-L)! - Add handler for signing fee and root tx intents

### Patch Changes

- [#1347](https://github.com/LedgerHQ/device-sdk-ts/pull/1347) [`ae31fcc`](https://github.com/LedgerHQ/device-sdk-ts/commit/ae31fcc504186452ed86c18dc6f656ac356998a3) Thanks [@pdeville-ledger](https://github.com/pdeville-ledger)! - Extract hardcoded appName string literals into shared APP_NAME constants

- [#1339](https://github.com/LedgerHQ/device-sdk-ts/pull/1339) [`af0cdab`](https://github.com/LedgerHQ/device-sdk-ts/commit/af0cdab3e708ab1521a27ad754680dd9d1863584) Thanks [@0xMM-L](https://github.com/0xMM-L)! - Remove the check on device flag for the get view key command

- [#1350](https://github.com/LedgerHQ/device-sdk-ts/pull/1350) [`7886fb4`](https://github.com/LedgerHQ/device-sdk-ts/commit/7886fb42a2b48c623226bd400a778bce9966ce38) Thanks [@0xMM-L](https://github.com/0xMM-L)! - Change error code message for the signer aleo

- Updated dependencies [[`b3a1237`](https://github.com/LedgerHQ/device-sdk-ts/commit/b3a12375828a542e1d7aa7111a8a0362bcb61106), [`3a8cb57`](https://github.com/LedgerHQ/device-sdk-ts/commit/3a8cb572d8884d34af05cbe969dd883bcf1b5add), [`14774e0`](https://github.com/LedgerHQ/device-sdk-ts/commit/14774e003e2ac03077cc6e8978cb94c02d624f02), [`1d58662`](https://github.com/LedgerHQ/device-sdk-ts/commit/1d586621b7a4a2ab6d3940aa6024abc2f6402c33)]:
  - @ledgerhq/signer-utils@1.2.0
  - @ledgerhq/context-module@1.16.0

All notable changes to this project will be documented in this file.

## [0.1.0] - 2026-02-05

### Added

- Initial signer implementation for aleo
