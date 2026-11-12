---
"@ledgerhq/context-module": minor
---

Attach the Ledger PKI certificate to ERC-20 token, external plugin, Uniswap token, NFT and plugin contexts, so the Ethereum app can verify them without its hardcoded keys. Breaking: `TokenContextLoader`, `NftContextLoader`, `NftContextFieldLoader`, `UniswapContextLoader` and `ExternalPluginContextLoader` now take a `PkiCertificateLoader` in their constructor. Their input now requires a `deviceModelId`, used to fetch the certificate: inputs without it are no longer handled.
