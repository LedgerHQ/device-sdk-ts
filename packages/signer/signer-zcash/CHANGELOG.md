# Changelog

## 0.7.0

### Minor Changes

- [#1743](https://github.com/LedgerHQ/device-sdk-ts/pull/1743) [`29a13b0`](https://github.com/LedgerHQ/device-sdk-ts/commit/29a13b08b878469508a58b957b0bbb1611c8f943) Thanks [@vladyslavchupovskiy-ext-art](https://github.com/vladyslavchupovskiy-ext-art)! - Implement GetAppConfigCommand — getAppConfig() now returns the Zcash app version (major, minor, patch) instead of throwing

### Patch Changes

- Updated dependencies [[`f5b3738`](https://github.com/LedgerHQ/device-sdk-ts/commit/f5b3738b3ffca4d6ced75497f50b494777a9c073), [`e946c4f`](https://github.com/LedgerHQ/device-sdk-ts/commit/e946c4fddcc770b32f9cf95a84cf7047bf14a06f), [`72eb0a4`](https://github.com/LedgerHQ/device-sdk-ts/commit/72eb0a484a43ad9195afe059b406d6941aeb8c10), [`911eb1d`](https://github.com/LedgerHQ/device-sdk-ts/commit/911eb1d9945aecd1b0f323a802ad0585e36f8da4), [`79c2060`](https://github.com/LedgerHQ/device-sdk-ts/commit/79c2060dd9ddf9872a73c24518a7875bf03a3f61), [`9552e82`](https://github.com/LedgerHQ/device-sdk-ts/commit/9552e829121e9d428c49084136744152c08c0b1c), [`3c071ba`](https://github.com/LedgerHQ/device-sdk-ts/commit/3c071ba2023b1f35e8dc28e4e9d46a46c582b568), [`57ddf0b`](https://github.com/LedgerHQ/device-sdk-ts/commit/57ddf0ba8ac2503f92d1bfb9c8f936a7a402da4a), [`fadb5c2`](https://github.com/LedgerHQ/device-sdk-ts/commit/fadb5c24d1bb7ce588f2d26d6fbc5692f5b29e95), [`575457e`](https://github.com/LedgerHQ/device-sdk-ts/commit/575457e53cfd6d59e6a273b897d4262b18d1611b), [`37ba2fd`](https://github.com/LedgerHQ/device-sdk-ts/commit/37ba2fd5583ab6477442627f182c2d493858a3b0), [`221cb79`](https://github.com/LedgerHQ/device-sdk-ts/commit/221cb79340eee27b0364e27db2b80e7dfef1b163), [`3f2f0cd`](https://github.com/LedgerHQ/device-sdk-ts/commit/3f2f0cddb28cd4b5fb142e27e983ac59110e17f1), [`c7ce54e`](https://github.com/LedgerHQ/device-sdk-ts/commit/c7ce54e5658266d0c1c3d3d76a820f82b6cdcd0a), [`95e2ce0`](https://github.com/LedgerHQ/device-sdk-ts/commit/95e2ce06155042764ee2ea8a8a0a9edab4366da5), [`bbab1db`](https://github.com/LedgerHQ/device-sdk-ts/commit/bbab1dbb4704f89506d0780d2ce0a044992a31d6)]:
  - @ledgerhq/device-management-kit@1.8.0

## 0.6.0

### Minor Changes

- [#1709](https://github.com/LedgerHQ/device-sdk-ts/pull/1709) [`5c07d01`](https://github.com/LedgerHQ/device-sdk-ts/commit/5c07d011d45669d8fbd489cbab201833f09e8c29) Thanks [@cted-ledger](https://github.com/cted-ledger)! - Stream a v6 (ZIP-229 / Ironwood) previous transaction for GET_TRUSTED_INPUT, so a UTXO created by one can be spent: read the fourth Ironwood action count, regroup that bundle per the ZIP-244 txid digest as the Orchard one already was, and leave out every shielded pool's anchor — Sapling included — which v6 moved to the authorizing digest.

- [#1709](https://github.com/LedgerHQ/device-sdk-ts/pull/1709) [`1020cb2`](https://github.com/LedgerHQ/device-sdk-ts/commit/1020cb2d7fc2dac3dd683fbf6c3ca78bea3bca30) Thanks [@cted-ledger](https://github.com/cted-ledger)! - Fail with `UnsupportedV6TransactionError`, carrying the installed app version, when a v6 (ZIP-229) previous transaction is about to be streamed to a Zcash app that predates v6 support — instead of letting that app answer a bare 6a80. The app version the device session reports is compared against the first version shipping v6, before any APDU is sent. `ZcashErrorCodes` is now exported so callers can match the error code without hardcoding it.

## 0.5.0

### Minor Changes

- [#1688](https://github.com/LedgerHQ/device-sdk-ts/pull/1688) [`d480142`](https://github.com/LedgerHQ/device-sdk-ts/commit/d4801425021f4c0fb99e4b2642bdbae50dac4532) Thanks [@may01](https://github.com/may01)! - Add Ironwood (NU6.3) PCZT v2 bundle signing support for V6 transactions

- [#1695](https://github.com/LedgerHQ/device-sdk-ts/pull/1695) [`e4925b8`](https://github.com/LedgerHQ/device-sdk-ts/commit/e4925b8f0b8c602509bf791e07620ff5b898b584) Thanks [@vladyslavchupovskiy-ext-art](https://github.com/vladyslavchupovskiy-ext-art)! - Add `getShieldedAddress` to `SignerZcash` for INS_GET_SHIELD_ADDR (0x51).

Sends the transparent derivation path (`44'/coin/account'/change/index`) together with the derived Orchard account path (`32'/coin/account'`) to the device. The device uses the transparent path for account matching and on-device display; the returned unified address contains a single Orchard receiver. Pass `checkOnDevice: true` to have the device display the address for user confirmation.

### Patch Changes

- [#1702](https://github.com/LedgerHQ/device-sdk-ts/pull/1702) [`ace9406`](https://github.com/LedgerHQ/device-sdk-ts/commit/ace940626888f9f5678cc80088d27f11245b227c) Thanks [@cted-ledger](https://github.com/cted-ledger)! - Regroup the shielded fields of a previous transaction per ZIP-244 digest when streaming it for GET_TRUSTED_INPUT, so the device commits to the right txid, and reject versions this flow does not support instead of streaming them as v5

## 0.4.3

### Patch Changes

- [#1672](https://github.com/LedgerHQ/device-sdk-ts/pull/1672) [`934c060`](https://github.com/LedgerHQ/device-sdk-ts/commit/934c060e78745807141c8740757129979aef0e47) Thanks [@cted-ledger](https://github.com/cted-ledger)! - Request a device spend-auth signature only for real Orchard spends. Dummy padding spends (spend value 0) are self-signed host-side by the PCZT IO finalizer, so signing them on-device made the device signature count exceed the finalizer's unsigned-action count and the transaction was rejected. The full bundle is still streamed to the device; only the signing requests are restricted to real spends.

## 0.4.2

### Patch Changes

- [#1648](https://github.com/LedgerHQ/device-sdk-ts/pull/1648) [`980abc8`](https://github.com/LedgerHQ/device-sdk-ts/commit/980abc8d926783aa558b46a8faf6090b8f56cf16) Thanks [@semeano](https://github.com/semeano)! - Fix UFVK export to support orchard + transparent paths

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
