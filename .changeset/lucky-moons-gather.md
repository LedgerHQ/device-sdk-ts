---
"@ledgerhq/device-signer-kit-zcash": patch
---

Regroup the shielded fields of a previous transaction per ZIP-244 digest when streaming it for GET_TRUSTED_INPUT, so the device commits to the right txid, and reject versions this flow does not support instead of streaming them as v5
