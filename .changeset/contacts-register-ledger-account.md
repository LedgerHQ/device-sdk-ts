---
"@ledgerhq/device-contacts-kit": minor
---

Add `ContactsManager.registerLedgerAccount`: the REGISTER LEDGER ACCOUNT operation (register a signer-controlled Ledger account derived on-device from a BIP32 path), reusing the shared Contacts protocol foundation (TLV serializer, chunked framing, error model, validation) with a version-guarded device action that opens the app by default, checks the Contacts version requirements, supports `skipOpenApp`, and returns the device-issued `hmacProof`
