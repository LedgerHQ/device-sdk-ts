---
"@ledgerhq/device-signer-kit-xrp": minor
---

Implement the XRP `SignTransactionCommand`. It builds the `E0 04` APDU for a single chunk, encoding its position in the sequence into P1 (`00` first and last, `80` first with more to come, `81` a middle chunk, `01` the last of several) and selecting secp256k1 in P2. The chunk is written as-is, so splitting the payload stays with the signing task. `parseResponse` returns `Maybe<Signature>` — the DER signature on the final chunk, `Nothing` for the empty body that acknowledges the others. `Signature` is now a `Uint8Array`, since DER signatures are variable length and are not the Ethereum signer's `{ r, s, v }`.
