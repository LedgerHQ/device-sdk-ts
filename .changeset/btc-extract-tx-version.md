---
"@ledgerhq/device-signer-kit-bitcoin": patch
---

Take the extracted transaction's version from PSBT_GLOBAL_TX_VERSION instead of the PSBT version, and default a missing input sequence to 0xffffffff
