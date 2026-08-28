---
"@ledgerhq/device-signer-kit-solana": patch
---

Request ALT_RESOLUTION for every ALT-backed account the device dereferences at finalize: writable instruction accounts, all value-flow-port candidates, port token references, PARAM_TOKEN_AMOUNT token refs and account-reset targets, on top of the display-field and mint-association accounts already covered
