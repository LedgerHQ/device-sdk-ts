---
"@ledgerhq/device-signer-kit-concordium": minor
---

Register the `0x6B11` status word the Concordium app returns when a PLT amount carries more than the 18 decimal places the app can display. It previously fell through to `UnknownDeviceExchangeError`; it now resolves to `ConcordiumErrorCodes.PLT_UNSUPPORTED_DECIMALS`, so consumers can match on it.
