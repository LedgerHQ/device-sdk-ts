---
"@ledgerhq/device-signer-kit-xrp": minor
---

Implement the XRP `GetAddressCommand`. It builds the `E0 02` APDU with P1 selecting display-and-confirm and P2 carrying the secp256k1 curve selector OR-ed with the return-chain-code flag, followed by the derivation path as a count byte and big-endian 32-bit elements. The response is parsed by its length prefixes into `{ publicKey, address, chainCode? }`, with the public key hex encoded and the address passed through as the ASCII the app returns. Adds the `Address` API model and a shared `validateDerivationPath` helper enforcing the app's 10-element limit.
