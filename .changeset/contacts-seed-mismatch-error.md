---
"@ledgerhq/device-management-kit": minor
"@ledgerhq/device-signer-kit-ethereum": minor
---

Surface a distinct seed-mismatch error for Contacts / address-book operations. Address-book entries are seed-bound, so editing a contact with a device holding a different seed fails the device's HMAC verification (status word `0x6982`). Add a `ContactsCommandError` and `CONTACT_SEED_MISMATCH_ERROR_CODE` (`"6982"`) so consumers (e.g. Ledger Wallet) can detect this case and guide the user to connect the original device. Rename Contact, Edit External Address Label, Edit External Address, and Register External Address now map `0x6982` to this typed error instead of an `UnknownDeviceExchangeError` or a misleading "Canceled by user" message.
