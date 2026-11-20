---
"@ledgerhq/device-signer-kit-xrp": minor
---

Clear sign MPT transactions: before signing, load the MPT descriptors from the context module and give them to XRP app 2.9.0 or later. Adds an optional context module and origin token to `SignerXrpBuilder`, makes `@ledgerhq/context-module` a peer dependency, and makes `contextModule` required on `SignTransactionDeviceActionFactory`
