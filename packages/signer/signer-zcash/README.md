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
