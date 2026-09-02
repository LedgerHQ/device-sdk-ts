# Changelog

All notable changes to this project will be documented in this file.

## 0.2.0

### Minor Changes

- [#1810](https://github.com/LedgerHQ/device-sdk-ts/pull/1810) [`babce76`](https://github.com/LedgerHQ/device-sdk-ts/commit/babce761c299f6bbfb7fce1151b054d3b7b8f8a0) Thanks [@OlivierFreyssinet](https://github.com/OlivierFreyssinet)! - Accept an optional Tron address book in SignerTrxBuilder via withAddressBook, exposing the TronAddressBook public model

- [#1602](https://github.com/LedgerHQ/device-sdk-ts/pull/1602) [`2294a8e`](https://github.com/LedgerHQ/device-sdk-ts/commit/2294a8e6583846b06f9a29637d7a23f9e91b2edd) Thanks [@daniel-choinski-ledger](https://github.com/daniel-choinski-ledger)! - Complete the Tron Get Address device action: derive the address and public key for a derivation path, with optional on-device verification (`checkOnDevice`) and `skipOpenApp`, plus a sample-app playground panel and unit/e2e coverage

- [#1624](https://github.com/LedgerHQ/device-sdk-ts/pull/1624) [`3df6886`](https://github.com/LedgerHQ/device-sdk-ts/commit/3df68869f30169254c3dca1a2313f12a8071b5fc) Thanks [@daniel-choinski-ledger](https://github.com/daniel-choinski-ledger)! - Complete the Tron Get App Configuration device action: read the app version and its `allowData`, `allowContract`, `truncateAddress` and `signByHash` flags from the device, plus a sample-app playground panel and unit/e2e coverage

- [#1668](https://github.com/LedgerHQ/device-sdk-ts/pull/1668) [`0767101`](https://github.com/LedgerHQ/device-sdk-ts/commit/0767101cd67cc294505a3976e6363136fc043a9e) Thanks [@daniel-choinski-ledger](https://github.com/daniel-choinski-ledger)! - Implement the Get ECDH Secret device action

- [#1660](https://github.com/LedgerHQ/device-sdk-ts/pull/1660) [`a7aee85`](https://github.com/LedgerHQ/device-sdk-ts/commit/a7aee8519a390cbf834995717cc714f586eaeae5) Thanks [@daniel-choinski-ledger](https://github.com/daniel-choinski-ledger)! - Implement the Sign Personal Message device action

- [#1667](https://github.com/LedgerHQ/device-sdk-ts/pull/1667) [`a32ed36`](https://github.com/LedgerHQ/device-sdk-ts/commit/a32ed36d2e2f6c727048cc8730f2255d90779a57) Thanks [@daniel-choinski-ledger](https://github.com/daniel-choinski-ledger)! - Implement the Sign Transaction Hash device action

- [#1644](https://github.com/LedgerHQ/device-sdk-ts/pull/1644) [`bfb232a`](https://github.com/LedgerHQ/device-sdk-ts/commit/bfb232ac7c96f77ab0fbbff855ab993b91a9d0fb) Thanks [@daniel-choinski-ledger](https://github.com/daniel-choinski-ledger)! - Implement the Sign Transaction device action

- [#1575](https://github.com/LedgerHQ/device-sdk-ts/pull/1575) [`5d6dca7`](https://github.com/LedgerHQ/device-sdk-ts/commit/5d6dca72ce683f12ffdb693eb3f3f6ddc48f5c35) Thanks [@daniel-choinski-ledger](https://github.com/daniel-choinski-ledger)! - Scaffold the Tron (TRX) signer package and define its public API (getAddress, signTransaction, signPersonalMessage, getAppConfiguration)

### Patch Changes

- Updated dependencies [[`30100b5`](https://github.com/LedgerHQ/device-sdk-ts/commit/30100b5a19cd977320a18338c08590a7830b58eb), [`943650b`](https://github.com/LedgerHQ/device-sdk-ts/commit/943650b911a9c9a07c3ad29ea2057eb8a4b99c07)]:
  - @ledgerhq/device-management-kit@1.9.0

## [0.1.0] - 2026-06-24

### Added

- Initial signer package scaffold and public API for Tron (TRX)
