---
"@ledgerhq/device-signer-kit-tron": minor
---

Show a saved contact name in place of the raw recipient address when reviewing a Tron transaction, matched against the address book given to `withAddressBook`. Only the transaction recipient is matched, and a contact the device rejects never costs the signature. `encodeTronAddress` and `decodeTronAddress` are exported alongside, since registering a contact through the contacts kit takes the raw address bytes an address book holds as base58.
