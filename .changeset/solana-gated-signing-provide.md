---
"@ledgerhq/device-signer-kit-solana": minor
---

Send the matching gating descriptor (INS 0x2A) before the transaction check, under the new `provideGatedSigning` step. After a failed generic clear-sign attempt, the descriptor the device accepted is sent again before the basic fallback, with no new CAL lookup. Gating is a default feature: `disabledFeatures` can't turn it off. It stays off for now: its minimum Solana app version is 10.0.0 until the app ships it
