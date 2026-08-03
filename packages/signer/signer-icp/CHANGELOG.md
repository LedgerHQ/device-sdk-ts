# @ledgerhq/device-signer-kit-icp

## 0.2.0

### Minor Changes

- [#1659](https://github.com/LedgerHQ/device-sdk-ts/pull/1659) [`af453f3`](https://github.com/LedgerHQ/device-sdk-ts/commit/af453f32f88cbd9f2cf26bf5772f6e2f53f5507a) Thanks [@lysyi3m](https://github.com/lysyi3m)! - Add the Internet Computer (ICP) signer kit with support for retrieving the address (public key, account identifier and principal), signing a transaction, and reading the app configuration.

- [#1683](https://github.com/LedgerHQ/device-sdk-ts/pull/1683) [`cd9a51b`](https://github.com/LedgerHQ/device-sdk-ts/commit/cd9a51b74b59d25b5f990b0d0318ad143ad4b105) Thanks [@lysyi3m](https://github.com/lysyi3m)! - Add update-call signing (`signUpdateCall`) for neuron management: signs an IC update call together with its companion read-state request and returns both signatures with the read-state body. Add a `stake` flag to `signTransaction` to sign a neuron-creation transfer.

### Patch Changes

- [#1677](https://github.com/LedgerHQ/device-sdk-ts/pull/1677) [`4088193`](https://github.com/LedgerHQ/device-sdk-ts/commit/40881930e4cc01f59783abca6797a183fd16769e) Thanks [@lysyi3m](https://github.com/lysyi3m)! - Fix GET_ADDR and SIGN response parsing to match the device wire format. GET_ADDR is decoded as fixed-length fields (publicKey, principal, account identifier, textual principal) instead of a length-prefixed layout, and the textual principal is grouped in 5-character segments. SIGN skips the pre-sign hash that precedes the signature on the last chunk. Also derive `testMode` from a non-zero flag byte.
