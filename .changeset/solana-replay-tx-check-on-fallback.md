---
"@ledgerhq/device-signer-kit-solana": patch
---

Re-send the transaction check before the basic sign when generic clear signing falls back, since the failed attempt wipes it on the device
