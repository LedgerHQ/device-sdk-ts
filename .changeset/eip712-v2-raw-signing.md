---
"@ledgerhq/device-signer-kit-ethereum": minor
---

Sign typed data through the EIP-712 V2 protocol on apps that implement it. V2 delivers the whole type dictionary and the whole value tree as one TLV payload each, then triggers the signature with a bare command, replacing V1's field-by-field streaming. It is raw-only for now, so the device displays every value unformatted and requires blind signing to be enabled.
