# @ledgerhq/device-signer-kit-concordium

## 0.3.0

### Minor Changes

- [#1434](https://github.com/LedgerHQ/device-sdk-ts/pull/1434) [`b473783`](https://github.com/LedgerHQ/device-sdk-ts/commit/b4737837cb50a260ff94b0745da3a288a1222999) Thanks [@lysyi3m](https://github.com/lysyi3m)! - `verifyAddress` now distinguishes between `AddressVerificationFailedError` (backend actively refused the pubkey → address mapping) and `TrustedMetadataServiceError` (backend unreachable / 5xx). The backend's reason is forwarded into `error.message`.

- [#1425](https://github.com/LedgerHQ/device-sdk-ts/pull/1425) [`eab6d58`](https://github.com/LedgerHQ/device-sdk-ts/commit/eab6d581496a6d6dd9cdbab131aa026870d6ad03) Thanks [@lysyi3m](https://github.com/lysyi3m)! - Add verifyAddress method with trusted backend support for secure on-device Concordium address verification

- [#1431](https://github.com/LedgerHQ/device-sdk-ts/pull/1431) [`f7f9234`](https://github.com/LedgerHQ/device-sdk-ts/commit/f7f923405e8b3b89977ef456c75ecd41f140be58) Thanks [@lysyi3m](https://github.com/lysyi3m)! - Surface trusted metadata service failures as a dedicated `TrustedMetadataServiceError` (error code `trusted_metadata_service_error`) so consumers can distinguish backend/network outages and malformed responses from on-device failures.

### Patch Changes

- Updated dependencies [[`c428276`](https://github.com/LedgerHQ/device-sdk-ts/commit/c42827651315a343eee47061c9751d30c4c379b8), [`c371e43`](https://github.com/LedgerHQ/device-sdk-ts/commit/c371e435f066346af656ffe8a0f5a2dcba26eee4), [`106a40f`](https://github.com/LedgerHQ/device-sdk-ts/commit/106a40f18f93d04b0eb2646e4b0f5af748df16d6), [`2d4950f`](https://github.com/LedgerHQ/device-sdk-ts/commit/2d4950f73e2fdb988c1d40a57f5813863457acf2), [`b473783`](https://github.com/LedgerHQ/device-sdk-ts/commit/b4737837cb50a260ff94b0745da3a288a1222999), [`006b63d`](https://github.com/LedgerHQ/device-sdk-ts/commit/006b63da567101999284691e15ed4d49473540e7), [`36105c4`](https://github.com/LedgerHQ/device-sdk-ts/commit/36105c4b319e9be5983958bed4031efdddefca01), [`99734ee`](https://github.com/LedgerHQ/device-sdk-ts/commit/99734ee385bcf94aa5b1b38879cd0bc1a28fa031), [`fc8c132`](https://github.com/LedgerHQ/device-sdk-ts/commit/fc8c132c59e5e0aaa3a9c2563006c32f7093ba34), [`3a86e5c`](https://github.com/LedgerHQ/device-sdk-ts/commit/3a86e5c7d2b33c054344bb2ec79261cc49a2b919)]:
  - @ledgerhq/context-module@1.17.0
  - @ledgerhq/device-management-kit@1.3.0

## 0.2.0

### Minor Changes

- [#1390](https://github.com/LedgerHQ/device-sdk-ts/pull/1390) [`795b4ef`](https://github.com/LedgerHQ/device-sdk-ts/commit/795b4ef05bf6d5317af750cf6ec808d889a3e38e) Thanks [@lysyi3m](https://github.com/lysyi3m)! - Initialize device-signer-kit-concordium package

- [#1417](https://github.com/LedgerHQ/device-sdk-ts/pull/1417) [`d3886f1`](https://github.com/LedgerHQ/device-sdk-ts/commit/d3886f14b18ff7ceddcb3ea36b672c9068f7ca95) Thanks [@lysyi3m](https://github.com/lysyi3m)! - Add app version query command and version-gating infrastructure

- [#1402](https://github.com/LedgerHQ/device-sdk-ts/pull/1402) [`e26e564`](https://github.com/LedgerHQ/device-sdk-ts/commit/e26e564f89f170beed81d99598b4f9720e139e84) Thanks [@lysyi3m](https://github.com/lysyi3m)! - Add signTransaction support with automatic Transfer/TransferWithMemo routing based on transaction type detection.

- [#1406](https://github.com/LedgerHQ/device-sdk-ts/pull/1406) [`db719bc`](https://github.com/LedgerHQ/device-sdk-ts/commit/db719bc03b121230acd0174a8fa1db5e17da5cfd) Thanks [@lysyi3m](https://github.com/lysyi3m)! - Add signCredentialDeploymentTransaction with raw byte parsing and multi-step APDU orchestration for credential deployment signing.

### Patch Changes

- Updated dependencies [[`b3a1237`](https://github.com/LedgerHQ/device-sdk-ts/commit/b3a12375828a542e1d7aa7111a8a0362bcb61106)]:
  - @ledgerhq/signer-utils@1.2.0
