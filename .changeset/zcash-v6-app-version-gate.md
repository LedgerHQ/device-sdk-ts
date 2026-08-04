---
"@ledgerhq/device-signer-kit-zcash": minor
---

Fail with `UnsupportedV6TransactionError`, carrying the installed app version, when a v6 (ZIP-229) previous transaction is about to be streamed to a Zcash app that predates v6 support — instead of letting that app answer a bare 6a80. The app version the device session reports is compared against the first version shipping v6, before any APDU is sent. `ZcashErrorCodes` is now exported so callers can match the error code without hardcoding it.
