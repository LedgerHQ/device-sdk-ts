# Signer hyperliquid

This package provides a signer implementation for hyperliquid.

## Installation

```bash
pnpm add @ledgerhq/device-signer-kit-hyperliquid
```

## Usage

```typescript
import { SignerHyperliquidBuilder } from "@ledgerhq/device-signer-kit-hyperliquid";

const signer = new SignerHyperliquidBuilder({ dmk, sessionId }).build();

// Sign transaction
const signature = await signer.signActions({
  derivationPath: "m/44'/0'/0'/0/0",
  certificate,
  signedMetadata,
  actions,
});
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
