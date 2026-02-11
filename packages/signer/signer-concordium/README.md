# Signer Concordium

This package provides a signer implementation for Concordium.

## Installation

```bash
pnpm add @ledgerhq/device-signer-kit-concordium
```

## Usage

```typescript
import { SignerConcordiumBuilder } from "@ledgerhq/device-signer-kit-concordium";

const signer = new SignerConcordiumBuilder({ dmk, sessionId }).build();

// Get address
const address = await signer.getAddress("m/44'/0'/0'/0/0");

// Sign transaction
const signature = await signer.signTransaction(
  "m/44'/0'/0'/0/0",
  transactionBytes
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
