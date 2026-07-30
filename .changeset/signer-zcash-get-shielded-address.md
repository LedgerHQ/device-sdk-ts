---
"@ledgerhq/signer-zcash": minor
---

Add `getShieldedAddress` to `SignerZcash` for INS_GET_SHIELD_ADDR (0x51).

Sends two length-prefixed derivation paths to the device (Orchard `32'/coin/account'` and transparent `44'/coin/account'/change/index`) and returns the unified address (`u1…`). Pass `checkOnDevice: true` to have the device display the address for user confirmation.
