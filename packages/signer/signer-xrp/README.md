# Signer xrp

This package provides a signer implementation for xrp.

## Installation

```bash
pnpm add @ledgerhq/device-signer-kit-xrp
```

## Usage

```typescript
import { SignerXrpBuilder } from "@ledgerhq/device-signer-kit-xrp";

const signer = new SignerXrpBuilder({ dmk, sessionId }).build();

// Get address
const { observable: address$ } = signer.getAddress("44'/144'/0'/0/0");

// Sign transaction
const { observable: signature$ } = signer.signTransaction(
  "44'/144'/0'/0/0",
  transactionBytes,
);
```

Each method returns an observable of the device action's state and a `cancel` function; the result is in the `output` of the `Completed` state.

### Transaction bytes

`signTransaction` expects the transaction serialized without the XRPL signing prefix: the XRP application prepends `STX\0` itself. For multi-signing, leave `SigningPubKey` empty: the application then prepends `SMT\0` instead and appends the account ID of the signing key. Serialize the transaction without `TxnSignature`, for example with `encode` from `ripple-binary-codec`, not `encodeForSigning` or `encodeForMultisigning`, which add the prefix: the application would then read it as a field header and misparse the transaction, and a signature made over it would not verify.

### Curves

The signer uses secp256k1 by default, like Ledger Wallet. For an account created with Ed25519, pass the same `curve` to both calls: on another curve, the same derivation path is a different XRPL account, and a signature made with the wrong curve is rejected by the network.

```typescript
import { Curve, SignerXrpBuilder } from "@ledgerhq/device-signer-kit-xrp";

const signer = new SignerXrpBuilder({ dmk, sessionId }).build();
const path = "44'/144'/0'/0/0";

const { observable: address$ } = signer.getAddress(path, {
  curve: Curve.Ed25519,
});

const { observable: signature$ } = signer.signTransaction(
  path,
  transactionBytes,
  { curve: Curve.Ed25519 },
);
```

With Ed25519, the public key starts with `ED` and the signature is 64 raw bytes instead of a DER signature. In both cases, its uppercase hex goes in `TxnSignature`.

Getting an Ed25519 address requires XRP app 2.8.0 or later: older versions answer `6f88`. Signing with Ed25519 works on older versions too.

## Development

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Test
pnpm test

# Lint
pnpm lint
```
