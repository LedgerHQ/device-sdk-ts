---
"@ledgerhq/device-signer-kit-zcash": minor
---

Add PCZT Orchard shielded signing. A new `signPcztTransaction` method streams the PCZT bundle (header, transparent inputs/outputs, Orchard actions) to the device and returns the per-action Orchard `spendAuthSig`s and per-input transparent signatures. The legacy transparent `signTransaction` path is unchanged.
