# Changelog

## 0.4.1

### Patch Changes

- [#1638](https://github.com/LedgerHQ/device-sdk-ts/pull/1638) [`bdcbd2a`](https://github.com/LedgerHQ/device-sdk-ts/commit/bdcbd2a9460b3242af9a5acfc7f4aee4601df7c0) Thanks [@cted-ledger](https://github.com/cted-ledger)! - Add the NU6.3 consensus branch id (0x37a5165b, mainnet activation height 3,428,143) to the Zcash transparent height→branch-id dispatch so transactions signed after NU6.3 activation are accepted by the network.

## 0.4.0

### Minor Changes

- [#1587](https://github.com/LedgerHQ/device-sdk-ts/pull/1587) [`a2fa9a5`](https://github.com/LedgerHQ/device-sdk-ts/commit/a2fa9a58a19867f7ba32c4953954644160576ee2) Thanks [@may01](https://github.com/may01)! - Add PCZT Orchard shielded signing. A new `signPcztTransaction` method streams the PCZT bundle (header, transparent inputs/outputs, Orchard actions) to the device and returns the per-action Orchard `spendAuthSig`s and per-input transparent signatures. The legacy transparent `signTransaction` path is unchanged.

## 0.3.0

### Minor Changes

- [#1498](https://github.com/LedgerHQ/device-sdk-ts/pull/1498) [`514c3a8`](https://github.com/LedgerHQ/device-sdk-ts/commit/514c3a825962b7c391247858969fd5d617a1853a) Thanks [@may01](https://github.com/may01)! - Implement transparent Zcash payment signing (`signTransaction`) with Ledger Wallet–compatible `LegacyCreateTransactionArg`, trusted-input flow, Sapling output commit, and signed transaction assembly. Add commands, task wiring, Vitest coverage, and README usage docs.

### Patch Changes

- [#1557](https://github.com/LedgerHQ/device-sdk-ts/pull/1557) [`e9f8d36`](https://github.com/LedgerHQ/device-sdk-ts/commit/e9f8d36c10c7ab0dbbef4d7ea420f4d65d3847ab) Thanks [@may01](https://github.com/may01)! - Add NU6.2 consensus branch id and fix v4 GET_TRUSTED_INPUT framing

- Updated dependencies [[`64bdd28`](https://github.com/LedgerHQ/device-sdk-ts/commit/64bdd28fc7dc9b85fa763d891fbcaf03d48da24f)]:
  - @ledgerhq/device-management-kit@1.7.1

## 0.2.0

### Minor Changes

- [#1378](https://github.com/LedgerHQ/device-sdk-ts/pull/1378) [`9b57a9a`](https://github.com/LedgerHQ/device-sdk-ts/commit/9b57a9ad38484e5d98816d83fd0ad55a21d843e9) Thanks [@semeano](https://github.com/semeano)! - Get trusted input

- [#1366](https://github.com/LedgerHQ/device-sdk-ts/pull/1366) [`a233319`](https://github.com/LedgerHQ/device-sdk-ts/commit/a2333195c48667979b7246414643d231f86e83b1) Thanks [@semeano](https://github.com/semeano)! - Scaffold for Zcash signer

- [#1466](https://github.com/LedgerHQ/device-sdk-ts/pull/1466) [`258eb2a`](https://github.com/LedgerHQ/device-sdk-ts/commit/258eb2a5e7b2208172f4f0f8c9483f0ddc5360cb) Thanks [@may01](https://github.com/may01)! - Add `getFullViewingKey` to export the Zcash full viewing key from the device.

### Patch Changes

- [#1428](https://github.com/LedgerHQ/device-sdk-ts/pull/1428) [`8c44435`](https://github.com/LedgerHQ/device-sdk-ts/commit/8c4443591f24a982d494fbc0b5327b6c69a802e2) Thanks [@may01](https://github.com/may01)! - Add Vitest coverage for GetAddress (command, use case, binder, default signer), wire test scripts, harden GetAddressCommand parsing and Zcash app errors, remove unused GetAddress device-action placeholder. Sample app: use Zcash coin type 133' in default derivation paths.

- [#1446](https://github.com/LedgerHQ/device-sdk-ts/pull/1446) [`5e812cf`](https://github.com/LedgerHQ/device-sdk-ts/commit/5e812cf549ac67d0528d3eebd102581fe3187835) Thanks [@OlivierFreyssinet](https://github.com/OlivierFreyssinet)! - Align Zcash app binder task typing with the DMK task result error contract.

- Updated dependencies [[`b06170e`](https://github.com/LedgerHQ/device-sdk-ts/commit/b06170e14252faddf9b2ff4d96cbb6f83927da4d)]:
  - @ledgerhq/device-management-kit@1.4.1

All notable changes to this project will be documented in this file.

## [0.1.0] - 2026-03-17

### Added

- Initial signer implementation for zcash
