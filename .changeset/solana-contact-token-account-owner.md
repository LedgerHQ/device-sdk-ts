---
"@ledgerhq/device-signer-kit-solana": minor
---

Match an SPL transfer to a saved contact through the owner of the recipient token account when it is not the contact's associated token account, using the owner attested by the clear-signing descriptors given to the device. The contact is then provided after those descriptors, before the signature is requested. Plain SPL `Transfer` instructions, which carry no mint, are matched the same way. When the generic clear-signing attempt falls back to the basic flow, which wipes what the device was given, the contact is provided again before the basic descriptors.
