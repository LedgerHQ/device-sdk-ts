# Signer zcash

This package provides a signer implementation for zcash.

## Installation

```bash
pnpm add @ledgerhq/device-signer-kit-zcash
```

## Usage

```typescript
import { SignerZcashBuilder } from "@ledgerhq/device-signer-kit-zcash";

const signer = new SignerZcashBuilder({ dmk, sessionId }).build();

// Get address (BIP44 path: m/44'/133'/account'/change/index — 133' is Zcash on SLIP-44)
const address = await signer.getAddress("m/44'/133'/0'/0/0");

// Get full viewing key — same derivation convention as getAddress.
// Default mode "ufvk": success output is { mode: "ufvk", fullViewingKey: string }.
// mode "orchardFvk": success output is { mode: "orchardFvk", fullViewingKey: Uint8Array }.
const fullViewingKey = await signer.getFullViewingKey("m/44'/133'/0'/0/0");
const orchardFvk = await signer.getFullViewingKey("m/44'/133'/0'/0/0", {
  mode: "orchardFvk",
});
// When the Zcash app is already open: { skipOpenApp: true }

// Sign transaction
const signature = await signer.signTransaction(
  "m/44'/133'/0'/0/0",
  transactionBytes,
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
