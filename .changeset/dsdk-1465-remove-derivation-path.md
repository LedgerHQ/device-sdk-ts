---
"@ledgerhq/device-contacts-kit": patch
---

Stop sending the `DERIVATION_PATH` TLV (tag `0x69`) on the external-address operations — Register External Address, Edit External Address Identifier, and Edit External Address Scope. The current Ethereum app rejects the tag on these ops (`0x6a80`) and no longer requires it; the path was a temporary coin-app requirement and is Ledger-Account only. The path was kit-internal (never part of the public input), so this is not a breaking API change. Note: this requires an Ethereum app build that has dropped the requirement — older apps that still mandate the path will fail these ops.
