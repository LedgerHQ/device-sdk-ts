---
"@ledgerhq/device-signer-kit-ethereum": minor
---

Support ERC-7730 v2 maps looked up by the device: provide the MAP_ENTRY matching the key read from the transaction (`PROVIDE MAP ENTRY` APDU `0x3A`) before the field referencing it, and resolve tokens and NFT collections from map entry values. Descriptors using maps are not clear signed on Ethereum app versions older than 1.23.0
