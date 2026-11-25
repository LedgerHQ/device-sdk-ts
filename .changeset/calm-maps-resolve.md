---
"@ledgerhq/context-module": minor
---

Support ERC-7730 v2 maps in calldata descriptors: accept `map` values and return `ETHEREUM_MAP_ENTRY` contexts, along with the map references of each field. The calldata loader now only runs when `ETHEREUM_MAP_ENTRY` is among the expected types: update `@ledgerhq/device-signer-kit-ethereum` together with this package
