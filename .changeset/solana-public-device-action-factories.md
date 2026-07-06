---
"@ledgerhq/device-signer-kit-solana": minor
---

Expose public `SignMessageDeviceActionFactory` and `GetAddressDeviceActionFactory` (mirroring the Ethereum signer kit) so consumers can compose their own `OpenApp -> GetAddress -> Sign` flows without deep-importing from `/internal/`. Also expose the user-rejection error publicly via the `isSolanaAppError` type guard and the `SolanaAppCommandError` class. `SolanaAppBinder.signMessage` and `.getAddress` now delegate to these factories to guarantee a single source of truth.
