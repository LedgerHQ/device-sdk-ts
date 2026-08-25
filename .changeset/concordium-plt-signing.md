---
"@ledgerhq/device-signer-kit-concordium": minor
---

Add PLT (Protocol Level Token) transaction signing. `signTransaction` now accepts serialized `TokenUpdate` transactions (kind 27) alongside `Transfer` (3) and `TransferWithMemo` (22), streaming them to the device over INS `0x27` as one INIT frame followed by CONT frames carrying the CIS-7 CBOR payload. The public API is unchanged; `maxFee` is ignored for PLT transactions, whose device review screens display no fee. PLT signing requires a Concordium app that supports INS `0x27` — older apps are rejected with `UnsupportedAppVersionError` so callers can prompt for an app update.
