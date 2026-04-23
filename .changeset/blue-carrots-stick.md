---
"@ledgerhq/device-signer-kit-concordium": minor
---

`verifyAddress` now distinguishes between `AddressVerificationFailedError` (backend actively refused the pubkey → address mapping) and `TrustedMetadataServiceError` (backend unreachable / 5xx). The backend's reason is forwarded into `error.message`.
