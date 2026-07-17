---
"@ledgerhq/device-signer-kit-solana": minor
---

Expose the sign-transaction device action publicly via `SignTransactionDeviceActionFactory` and promote `SignTransactionDAInput`, `signTransactionDAStateSteps`, `SignTransactionDAStateStep` and `ClearSignMode` so consumers can compose their own device action flow (e.g. OpenApp → GetAddress → SignTransaction)
