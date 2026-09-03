---
"@ledgerhq/device-signer-kit-zcash": patch
---

Map the status words the Zcash app returns for an unmet signing precondition, a version parsing failure and an RNG failure, so they surface as named errors instead of UnknownError
