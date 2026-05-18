---
"@ledgerhq/device-signer-kit-concordium": minor
---

`signTransaction` now takes a required `maxFee: bigint` (µCCD) as its third positional argument, ahead of `options`. The value is forwarded to the device for display only and is not part of the canonical signed bytes. Requires Concordium app version 5.6.0+ on the device; on older firmware the value is dropped at the wire boundary and signing falls back to the legacy display layout. Invalid `maxFee` values (non-bigint, negative, or above uint64 range) are rejected with `InvalidMaxFeeError` (errorCode `"invalid_max_fee"`).
