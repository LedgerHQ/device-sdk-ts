---
"@ledgerhq/device-signer-kit-solana": minor
---

Support witnessed reset scopes: read the witness from CAL and resolve the account at each end of it, as the clear-signing spec lists. A descriptor whose reset index is out of range of its instruction is now reported as stale before any descriptor is streamed, instead of failing at finalize
