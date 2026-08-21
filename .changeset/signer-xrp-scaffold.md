---
"@ledgerhq/device-signer-kit-xrp": minor
---

Scaffold the XRP signer kit package following the signer-kit public/internal architecture and dependency-injection conventions. Exposes the `SignerXrp` interface and `SignerXrpBuilder`, with placeholders for the `getAppConfig`, `getAddress` and `signTransaction` flows. The APDU commands and device actions are not implemented yet and throw at runtime — those are added by their dedicated tickets.
