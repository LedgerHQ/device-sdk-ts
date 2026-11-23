---
"@ledgerhq/device-signer-kit-solana": patch
---

Stop fetching a token account state for the target of an IS_SIGNER hide rule. The Solana app (from 1.18) holds that rule only for the device's own key, so an attested owner can no longer change its answer
