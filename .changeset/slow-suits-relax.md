---
"@ledgerhq/device-signer-kit-ethereum": patch
---

Use chainId only when checkOnDevice is enabled for getAddress

- getAddress: `chainId` option is ignored when `checkOnDevice` is false; when true, it is sent to the device and used for dynamic network context (e.g. network name and icon).
- GetAddressCommand: chain ID is included in the APDU only when `checkOnDevice` is true (defaults to 1 when omitted).
