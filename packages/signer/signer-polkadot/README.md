# Signer polkadot

This package provides a signer implementation for polkadot.

## Installation

```bash
pnpm add @ledgerhq/device-signer-kit-polkadot
```

## Usage

Each method returns an object holding an `observable` and a `cancel` method — it is
not a promise.

The derivation path is passed without an `m/` prefix, and the device only accepts
paths under `44'/354'` (the Polkadot-family coin type). Anything else is refused
with `Data is invalid`.

```typescript
import { SignerPolkadotBuilder } from "@ledgerhq/device-signer-kit-polkadot";

const signer = new SignerPolkadotBuilder({ dmk, sessionId }).build();

// Get address — 42 is the SS58 prefix (0 for Polkadot, 42 for generic Substrate)
const { observable, cancel } = signer.getAddress("44'/354'/0'/0'/0'", 42);

// Sign transaction — `blob` is the payload to sign, `metadata` the proof used for
// clear signing. The returned signature is 65 bytes: a 1-byte MultiSignature
// discriminant followed by the 64-byte Ed25519 signature.
const { observable: signObservable } = signer.signTransaction(
  "44'/354'/0'/0'/0'",
  blob,
  metadata,
);
```

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
