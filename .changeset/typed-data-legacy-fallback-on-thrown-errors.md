---
"@ledgerhq/device-signer-kit-ethereum": patch
---

Fall back to legacy hash signing when the typed data flow throws instead of returning a failed command result (e.g. transport errors while streaming large EIP-712 payloads). Previously, thrown errors during ProvideContext and SignTypedData bypassed the SignTypedDataLegacy fallback and terminated the device action, leaving oversized typed data unsignable. User refusals (0x6985) still surface as errors without fallback.
