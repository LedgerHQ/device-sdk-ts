---
"@ledgerhq/device-signer-kit-zcash": minor
---

Add `getShieldedAddress` to `SignerZcash` for INS_GET_SHIELD_ADDR (0x51).

Sends the transparent derivation path (`44'/coin/account'/change/index`) together with the derived Orchard account path (`32'/coin/account'`) to the device. The device uses the transparent path for account matching and on-device display; the returned unified address contains a single Orchard receiver. Pass `checkOnDevice: true` to have the device display the address for user confirmation.
