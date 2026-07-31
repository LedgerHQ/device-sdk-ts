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

### Get address

Derives the Tron address and public key for a BIP32 derivation path (Tron uses
coin type `195`).

```typescript
signer.getAddress(
  derivationPath: string,
  options?: {
    // Display the address on the device for user verification (default: false).
    checkOnDevice?: boolean;
    // Skip the "open app" step if the Tron app is already open (default: false).
    skipOpenApp?: boolean;
  },
): GetAddressDAReturnType;
```

The returned device action resolves to:

```typescript
{
  address: string; // Base58Check Tron address, e.g. "TWdnWBzFdBP1b8sqZ5RcFDbkV3sBmnxsYu"
  publicKey: string; // hex-encoded public key
  chainCode?: string; // hex-encoded chain code (only when requested)
}
```

```typescript
const { observable, cancel } = signer.getAddress("44'/195'/0'/0/0", {
  checkOnDevice: true,
});

observable.subscribe((state) => {
  switch (state.status) {
    case "completed":
      console.log(state.output.address, state.output.publicKey);
      break;
    case "error":
      console.error(state.error);
      break;
  }
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
