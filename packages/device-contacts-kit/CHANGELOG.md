# @ledgerhq/device-contacts-kit

## 0.3.0

### Minor Changes

- [#1803](https://github.com/LedgerHQ/device-sdk-ts/pull/1803) [`8b6e876`](https://github.com/LedgerHQ/device-sdk-ts/commit/8b6e876044963167b24a34e532d6612318c8d844) Thanks [@daniel-choinski-ledger](https://github.com/daniel-choinski-ledger)! - Add `ContactsManager.editExternalAddressIdentifier`: the EDIT IDENTIFIER operation (replace the identifier bytes of an existing external-address entry within a contact group), with a version-guarded device action that opens the app by default, checks the Contacts version requirements, and supports `skipOpenApp`. Rotates only the address-level `hmacRest` and preserves the contact-group `hmacProof`.

- [#1825](https://github.com/LedgerHQ/device-sdk-ts/pull/1825) [`7180695`](https://github.com/LedgerHQ/device-sdk-ts/commit/718069578914efea354c8b81b6e52c8455acc00f) Thanks [@daniel-choinski-ledger](https://github.com/daniel-choinski-ledger)! - Add `ContactsManager.editExternalAddressScope`: the EDIT SCOPE operation (replace the scope of an existing external-address entry within a contact group, keeping the same contact name and identifier), with a version-guarded device action that opens the app by default, checks the Contacts version requirements, and supports `skipOpenApp`. Rotates only the address-level `hmacRest` and preserves the contact-group `hmacProof`.

### Patch Changes

- [#1830](https://github.com/LedgerHQ/device-sdk-ts/pull/1830) [`8d5f425`](https://github.com/LedgerHQ/device-sdk-ts/commit/8d5f425e3d913dc5a6eaa0e83117ce1498e9cf99) Thanks [@daniel-choinski-ledger](https://github.com/daniel-choinski-ledger)! - Stop sending the `DERIVATION_PATH` TLV (tag `0x69`) on the external-address operations — Register External Address, Edit External Address Identifier, and Edit External Address Scope. The current Ethereum app rejects the tag on these ops (`0x6a80`) and no longer requires it; the path was a temporary coin-app requirement and is Ledger-Account only. The path was kit-internal (never part of the public input), so this is not a breaking API change. Note: this requires an Ethereum app build that has dropped the requirement — older apps that still mandate the path will fail these ops.

## 0.2.0

### Minor Changes

- [#1716](https://github.com/LedgerHQ/device-sdk-ts/pull/1716) [`3a10c68`](https://github.com/LedgerHQ/device-sdk-ts/commit/3a10c68db0b6571514dd0b4fd1960c85fb0669d1) Thanks [@daniel-choinski-ledger](https://github.com/daniel-choinski-ledger)! - Scaffold the Contacts (Address Book) kit package following the signer-kit public/internal architecture and dependency-injection conventions. Exposes the `ContactsManager` interface and `ContactsManagerBuilder` (receiving `dmk`, `sessionId`, `appName`), with the DI container binding `dmk`, `sessionId`, `appName`, and `ContactsAppBinder`. No concrete Contacts operations yet — those are added by their dedicated tickets.

- [#1739](https://github.com/LedgerHQ/device-sdk-ts/pull/1739) [`d831ae1`](https://github.com/LedgerHQ/device-sdk-ts/commit/d831ae1b622b0e0d87cb246988da0c087b93976b) Thanks [@daniel-choinski-ledger](https://github.com/daniel-choinski-ledger)! - Add `ContactsManager.registerExternalAddress`: the REGISTER IDENTITY operation (register an external address, either in a new contact group or added to an existing one), with the shared Contacts protocol foundation (TLV serializer, chunked framing, error model, validation) and a version-guarded device action that opens the app by default, checks the Contacts version requirements, and supports `skipOpenApp`

- [#1733](https://github.com/LedgerHQ/device-sdk-ts/pull/1733) [`131a330`](https://github.com/LedgerHQ/device-sdk-ts/commit/131a330511ccc8af0a63548db27237ac029118e3) Thanks [@daniel-choinski-ledger](https://github.com/daniel-choinski-ledger)! - Add Contacts version-requirements API: static per-device-model minimum OS and app versions, with pure `resolveContactsVersionRequirements` / `isContactsSupported` helpers for hosts and an internal session-aware check for Contacts device actions
