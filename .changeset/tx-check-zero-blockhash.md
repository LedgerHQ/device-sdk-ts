---
"@ledgerhq/device-signer-kit-solana": patch
---

Fix Solana transaction check showing "unavailable" on device: fetch the scan descriptor over the blockhash-zeroed message so the verdict matches the fingerprint the device computes when signing
