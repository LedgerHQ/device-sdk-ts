---
"@ledgerhq/device-signer-kit-xrp": minor
---

Add the XRP `SendSignTransactionTask`, the chunking loop driving `SignTransactionCommand`. It prepends the encoded derivation path to the transaction, splits the result into `APDU_MAX_PAYLOAD` sized chunks and sends each with the right first/last flags, returning the signature the app answers with on the last one. Empty transactions and paths longer than 10 elements are rejected before anything reaches the device.
