# Signer Tron

This package provides a signer implementation for Tron (TRX).

## Installation

```bash
pnpm add @ledgerhq/device-signer-kit-tron
```

## Usage

```typescript
import { SignerTrxBuilder } from "@ledgerhq/device-signer-kit-tron";

const signer = new SignerTrxBuilder({ dmk, sessionId }).build();

// Get address (Tron uses the BIP44 coin type 195)
const { observable } = signer.getAddress("44'/195'/0'/0/0", {
  checkOnDevice: true,
});

// Sign a raw transaction
const { observable: signObservable } = signer.signTransaction(
  "44'/195'/0'/0/0",
  rawTransaction,
);

// Sign a personal message
const { observable: messageObservable } = signer.signPersonalMessage(
  "44'/195'/0'/0/0",
  "Hello Tron",
);

// Read the Tron app configuration
const { observable: configObservable } = signer.getAppConfiguration();
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
