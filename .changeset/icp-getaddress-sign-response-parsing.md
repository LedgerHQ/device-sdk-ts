---
"@ledgerhq/device-signer-kit-icp": patch
---

Fix GET_ADDR and SIGN response parsing to match the device wire format. GET_ADDR is decoded as fixed-length fields (publicKey, principal, account identifier, textual principal) instead of a length-prefixed layout, and the textual principal is grouped in 5-character segments. SIGN skips the pre-sign hash that precedes the signature on the last chunk. Also derive `testMode` from a non-zero flag byte.
