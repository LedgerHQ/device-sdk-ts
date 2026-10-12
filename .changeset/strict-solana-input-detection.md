---
"@ledgerhq/device-signer-kit-solana": patch
---

Improve transaction input detection: a raw message or a full transaction is only recognised when it decodes to a well-formed message ending exactly at the input end
