---
"@ledgerhq/device-signer-kit-xrp": minor
---

Support Ed25519 in the XRP signer: `getAddress` and `signTransaction` take an optional `curve` option (`Curve.Secp256k1` by default, or `Curve.Ed25519`).
