---
"@ledgerhq/device-signer-kit-ethereum": patch
---

Normalize EIP-712 `domain.chainId` to `number | null` before reporting blind signing events, fixing a "chainId invalid type" error when dapps provide a hex string (e.g. `"0x1"`)
