---
"@ledgerhq/device-signer-kit-solana": minor
---

Show a saved contact name in place of the raw recipient address when reviewing a Solana transaction, matched against the address book given to `withAddressBook`. Native SOL transfers and SPL `TransferChecked` to an associated token account are matched when the transaction has a single recipient, and a contact the device rejects never costs the signature.
