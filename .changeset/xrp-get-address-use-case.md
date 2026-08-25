---
"@ledgerhq/device-signer-kit-xrp": minor
---

Wire `getAddress` through the full stack. `AddressOptions` gains `returnChainCode`, defaulting to `false`, and `XrpAppBinder.getAddress` now builds its device action through the exported `GetAddressDeviceActionFactory`, requiring an address verification only when `checkOnDevice` is set.
