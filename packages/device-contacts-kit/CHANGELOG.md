# @ledgerhq/device-contacts-kit

## 0.2.0

### Minor Changes

- [#1716](https://github.com/LedgerHQ/device-sdk-ts/pull/1716) [`3a10c68`](https://github.com/LedgerHQ/device-sdk-ts/commit/3a10c68db0b6571514dd0b4fd1960c85fb0669d1) Thanks [@daniel-choinski-ledger](https://github.com/daniel-choinski-ledger)! - Scaffold the Contacts (Address Book) kit package following the signer-kit public/internal architecture and dependency-injection conventions. Exposes the `ContactsManager` interface and `ContactsManagerBuilder` (receiving `dmk`, `sessionId`, `appName`), with the DI container binding `dmk`, `sessionId`, `appName`, and `ContactsAppBinder`. No concrete Contacts operations yet — those are added by their dedicated tickets.

- [#1739](https://github.com/LedgerHQ/device-sdk-ts/pull/1739) [`d831ae1`](https://github.com/LedgerHQ/device-sdk-ts/commit/d831ae1b622b0e0d87cb246988da0c087b93976b) Thanks [@daniel-choinski-ledger](https://github.com/daniel-choinski-ledger)! - Add `ContactsManager.registerExternalAddress`: the REGISTER IDENTITY operation (register an external address, either in a new contact group or added to an existing one), with the shared Contacts protocol foundation (TLV serializer, chunked framing, error model, validation) and a version-guarded device action that opens the app by default, checks the Contacts version requirements, and supports `skipOpenApp`

- [#1733](https://github.com/LedgerHQ/device-sdk-ts/pull/1733) [`131a330`](https://github.com/LedgerHQ/device-sdk-ts/commit/131a330511ccc8af0a63548db27237ac029118e3) Thanks [@daniel-choinski-ledger](https://github.com/daniel-choinski-ledger)! - Add Contacts version-requirements API: static per-device-model minimum OS and app versions, with pure `resolveContactsVersionRequirements` / `isContactsSupported` helpers for hosts and an internal session-aware check for Contacts device actions
