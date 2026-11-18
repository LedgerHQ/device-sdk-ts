---
"@ledgerhq/device-signer-kit-solana": minor
---

Resolve both ends of a witnessed reset scope, so a Jupiter setTokenLedger and the route that reads its ledger through an address lookup table can merge on the device. A descriptor whose reset index is out of range of its instruction is now reported as stale before any descriptor is streamed, instead of failing at finalize
