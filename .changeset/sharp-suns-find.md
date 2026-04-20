---
"@ledgerhq/device-signer-kit-concordium": minor
---

Surface trusted metadata service failures as a dedicated `TrustedMetadataServiceError` (error code `trusted_metadata_service_error`) so consumers can distinguish backend/network outages and malformed responses from on-device failures.
