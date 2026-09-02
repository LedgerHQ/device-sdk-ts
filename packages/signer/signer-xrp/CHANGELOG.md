# Changelog

All notable changes to this project will be documented in this file.

## 0.2.0

### Minor Changes

- [#1777](https://github.com/LedgerHQ/device-sdk-ts/pull/1777) [`b8f059d`](https://github.com/LedgerHQ/device-sdk-ts/commit/b8f059d6963feff928d0639266869f607b5fe51e) Thanks [@aussedatlo](https://github.com/aussedatlo)! - `SignerXrp.getAppConfig` now accepts an optional `AppConfigOptions` (`{ skipOpenApp?: boolean }`), defaulting `skipOpenApp` to `false`.

- [#1767](https://github.com/LedgerHQ/device-sdk-ts/pull/1767) [`4cebd42`](https://github.com/LedgerHQ/device-sdk-ts/commit/4cebd4236d4725cdb8f6be2c99a0438ab15a5831) Thanks [@aussedatlo](https://github.com/aussedatlo)! - Scaffold the XRP signer kit package following the signer-kit public/internal architecture and dependency-injection conventions. Exposes the `SignerXrp` interface and `SignerXrpBuilder`, with placeholders for the `getAppConfig`, `getAddress` and `signTransaction` flows. The APDU commands and device actions are not implemented yet and throw at runtime — those are added by their dedicated tickets.

- [#1782](https://github.com/LedgerHQ/device-sdk-ts/pull/1782) [`195bc46`](https://github.com/LedgerHQ/device-sdk-ts/commit/195bc46c3696edd67201867d1b53796196aa808c) Thanks [@aussedatlo](https://github.com/aussedatlo)! - Implement the XRP `GetAddressCommand`. It builds the `E0 02` APDU with P1 selecting display-and-confirm and P2 carrying the secp256k1 curve selector OR-ed with the return-chain-code flag, followed by the derivation path as a count byte and big-endian 32-bit elements. The response is parsed by its length prefixes into `{ publicKey, address, chainCode? }`, with the public key hex encoded and the address passed through as the ASCII the app returns. Adds the `Address` API model and a shared `validateDerivationPath` helper enforcing the app's 10-element limit.

- [#1783](https://github.com/LedgerHQ/device-sdk-ts/pull/1783) [`e657ef6`](https://github.com/LedgerHQ/device-sdk-ts/commit/e657ef6aa29f35f6f545891755bef81a1cec3381) Thanks [@aussedatlo](https://github.com/aussedatlo)! - Wire `getAddress` through the full stack. `AddressOptions` gains `returnChainCode`, defaulting to `false`, and `XrpAppBinder.getAddress` now builds its device action through the exported `GetAddressDeviceActionFactory`, requiring an address verification only when `checkOnDevice` is set.

- [#1776](https://github.com/LedgerHQ/device-sdk-ts/pull/1776) [`13f8731`](https://github.com/LedgerHQ/device-sdk-ts/commit/13f87319193449f1182526a40f292471f1e9388d) Thanks [@aussedatlo](https://github.com/aussedatlo)! - Implement the XRP `getAppConfig` flow. `GetAppConfigCommand` now builds the real `E0 06 00 00` APDU and parses the device response (`[flags, major, minor, patch]`) into `{ version: "major.minor.patch" }`, skipping the RFU flags byte. Adds the XRP application status words (`XRP_APP_ERRORS`, `XrpAppCommandError`) and the XRP APDU header constants, and fixes the app name used to open the application (`XRP`).

- [#1789](https://github.com/LedgerHQ/device-sdk-ts/pull/1789) [`dbaf82b`](https://github.com/LedgerHQ/device-sdk-ts/commit/dbaf82b621cc51de3c6c159ad9423dd9f67542f0) Thanks [@aussedatlo](https://github.com/aussedatlo)! - Add the XRP `SendSignTransactionTask`, the chunking loop driving `SignTransactionCommand`. It prepends the encoded derivation path to the transaction, splits the result into `APDU_MAX_PAYLOAD` sized chunks and sends each with the right first/last flags, returning the signature the app answers with on the last one. Empty transactions and paths longer than 10 elements are rejected before anything reaches the device.

- [#1788](https://github.com/LedgerHQ/device-sdk-ts/pull/1788) [`3343bec`](https://github.com/LedgerHQ/device-sdk-ts/commit/3343bec1e2c40a5b66459f151dff34daced97182) Thanks [@aussedatlo](https://github.com/aussedatlo)! - Implement the XRP `SignTransactionCommand`. It builds the `E0 04` APDU for a single chunk, encoding its position in the sequence into P1 (`00` first and last, `80` first with more to come, `81` a middle chunk, `01` the last of several) and selecting secp256k1 in P2. The chunk is written as-is, so splitting the payload stays with the signing task. `parseResponse` returns `Maybe<Signature>` — the DER signature on the final chunk, `Nothing` for the empty body that acknowledges the others. `Signature` is now a `Uint8Array`, since DER signatures are variable length and are not the Ethereum signer's `{ r, s, v }`.

- [#1790](https://github.com/LedgerHQ/device-sdk-ts/pull/1790) [`195fc3e`](https://github.com/LedgerHQ/device-sdk-ts/commit/195fc3eb2417ce433d47efac2ebd8f2f921fa7bb) Thanks [@aussedatlo](https://github.com/aussedatlo)! - Wire `signTransaction` through the full stack. `XrpAppBinder.signTransaction` now builds its device action through the exported `SignTransactionDeviceActionFactory`, which runs `SendSignTransactionTask` — so transactions are chunked and carry their derivation path, which the previous scaffold did not do. Adds a `DmkLoggerFactory` binding for the task's logger, and `SignerXrp.signTransaction` defaults `skipOpenApp` to `false`.

### Patch Changes

- Updated dependencies [[`30100b5`](https://github.com/LedgerHQ/device-sdk-ts/commit/30100b5a19cd977320a18338c08590a7830b58eb), [`943650b`](https://github.com/LedgerHQ/device-sdk-ts/commit/943650b911a9c9a07c3ad29ea2057eb8a4b99c07)]:
  - @ledgerhq/device-management-kit@1.9.0

## [0.1.0] - 2026-08-21

### Added

- Initial signer implementation for xrp
