---
"@ledgerhq/device-signer-kit-solana": patch
---

Stop zeroing the blockhash before provisioning: the transaction check and the previews now use the original transaction, fixing "Transaction Check unavailable" on generic clear signing
