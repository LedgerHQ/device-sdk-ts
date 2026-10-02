---
"@ledgerhq/context-module": minor
---

Support Uniswap V4 swaps in the Uniswap context loader: decode the V4_SWAP
command's nested action program (both Universal Router 2.0 and 2.1.1 input
layouts) to provide token descriptors for V4 route currencies, drop the
route-shape restriction (chained, split and mixed-version routes are enforced
by the plugin on-device), refresh the wrapped-native table (new chains, Blast
chain id fix) and align the Permit2 command bytes with the Universal Router
dispatch table.
