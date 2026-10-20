---
"@ledgerhq/device-signer-kit-solana": minor
---

Route native staking transactions (stake, unstake, withdraw) straight to the basic flow through a rules-driven matcher, skipping generic clear signing. Only shapes the Solana app's basic flow can display are routed: one staking operation, ComputeBudget only at the start, and no address lookup tables
