# Signer Vechain

This package provides a signer implementation for Vechain.

## Installation

```bash
pnpm add @ledgerhq/device-signer-kit-vechain
```

## Usage

```typescript
import { SignerVechainBuilder } from "@ledgerhq/device-signer-kit-vechain";

const signer = new SignerVechainBuilder({ dmk, sessionId }).build();

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
