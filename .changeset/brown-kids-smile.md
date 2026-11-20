---
"@ledgerhq/device-signer-kit-solana": patch
---

Upgrade @solana/web3.js to v3, which is built on @solana/kit. This removes the legacy web3.js v1 dependency tree (bn.js, borsh, jayson, rpc-websockets, superstruct) from the signer. No API change.
