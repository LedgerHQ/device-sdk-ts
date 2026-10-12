# Signer Hedera

This package provides a signer implementation for the Hedera app ([app-hedera](https://github.com/LedgerHQ/app-hedera)).

## Installation

```bash
pnpm add @ledgerhq/device-signer-kit-hedera
```

## Usage

```typescript
import { SignerHederaBuilder } from "@ledgerhq/device-signer-kit-hedera";

const signer = new SignerHederaBuilder({ dmk, sessionId }).build();

// Get the app configuration
const appConfig = signer.getAppConfig();

// Get the Ed25519 public key of a key index (hex string)
const publicKey = signer.getPublicKey(0, { checkOnDevice: true });

// Sign a serialized Hedera TransactionBody (64-byte Ed25519 signature)
const signature = signer.signTransaction(0, transactionBody);
```

Each method returns `{ observable, cancel }`, the observable emitting `DeviceActionState` updates.

### Key index

The Hedera app does not take a BIP32 path. It reads a 4-byte little-endian key index and derives
`m/44'/3030'/0'/0'/<keyIndex>'` itself, so `getPublicKey` and `signTransaction` take a `keyIndex`
(an unsigned 32-bit integer).

### Transaction size

The transaction body is sent in a single APDU after the key index, so it can be at most 251 bytes.
Larger bodies are rejected before anything is sent to the device.

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
