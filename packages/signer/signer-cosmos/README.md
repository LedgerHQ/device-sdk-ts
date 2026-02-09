# Signer Cosmos

This package provides a signer implementation for Cosmos.

## Installation

```bash
pnpm add @ledgerhq/device-signer-kit-cosmos
```

## Usage

```typescript
import { SignerCosmosBuilder } from "@ledgerhq/device-signer-kit-cosmos";

const signer = new SignerCosmosBuilder({ dmk, sessionId }).build();

// Get address
const address = await signer.getAddress("m/44'/0'/0'/0/0");

// Sign transaction
const signature = await signer.signTransaction(
  "m/44'/118'/0'/0/0",
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
