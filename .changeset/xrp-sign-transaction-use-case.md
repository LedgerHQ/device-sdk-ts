---
"@ledgerhq/device-signer-kit-xrp": minor
---

Wire `signTransaction` through the full stack. `XrpAppBinder.signTransaction` now builds its device action through the exported `SignTransactionDeviceActionFactory`, which runs `SendSignTransactionTask` — so transactions are chunked and carry their derivation path, which the previous scaffold did not do. Adds a `DmkLoggerFactory` binding for the task's logger, and `SignerXrp.signTransaction` defaults `skipOpenApp` to `false`.
