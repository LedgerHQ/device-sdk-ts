---
"@ledgerhq/device-signer-kit-solana": patch
---

`signTransaction` now accepts both `tx.serialize()` (full wire-format) and `tx.serializeMessage()` (raw message bytes). When the full wire-format is provided, co-signer signatures are forwarded to Transaction Check automatically. The `serializedTransactionForTransactionCheck` field has been removed from `SolanaTransactionOptionalConfig`.
