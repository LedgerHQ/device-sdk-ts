---
"@ledgerhq/device-signer-kit-zcash": patch
---

Request a device spend-auth signature only for real Orchard spends. Dummy padding spends (spend value 0) are self-signed host-side by the PCZT IO finalizer, so signing them on-device made the device signature count exceed the finalizer's unsigned-action count and the transaction was rejected. The full bundle is still streamed to the device; only the signing requests are restricted to real spends.
