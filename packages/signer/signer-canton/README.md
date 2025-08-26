# @ledgerhq/device-signer-kit-canton

A Ledger Device SDK signer package for the Canton cryptocurrency.

## Features

- **Get Address**: Retrieve Canton addresses from Ledger devices
- **Sign Transaction**: Sign Canton transactions using Ledger devices

## Installation

```bash
npm install @ledgerhq/device-signer-kit-canton
```

## Usage

```typescript
import { SignerCantonBuilder } from '@ledgerhq/device-signer-kit-canton';

// Create a signer instance
const signerBuilder = new SignerCantonBuilder({ dmk, sessionId });
const signer = signerBuilder.build();

// Get an address
const addressResult = await signer.getAddress("44'/60'/0'/0/0", {
  checkOnDevice: true,
  skipOpenApp: false,
});

// Sign a transaction
const signatureResult = await signer.signTransaction(
  "44'/60'/0'/0/0",
  "transaction_data_here",
  {}
);
```

## API Reference

### SignerCanton

The main interface for interacting with Canton on Ledger devices.

#### Methods

- `getAddress(derivationPath: string, options?: AddressOptions): GetAddressDAReturnType`
- `signTransaction(derivationPath: string, transaction: Transaction, options?: TransactionOptions): SignTransactionDAReturnType`

### AddressOptions

```typescript
type AddressOptions = {
  checkOnDevice?: boolean;
  skipOpenApp?: boolean;
};
```

### TransactionOptions

```typescript
type TransactionOptions = {
  // Canton-specific transaction options
};
```

## Development

This package is part of the Ledger Device SDK and follows the same development patterns as other signer packages.

### Building

```bash
pnpm build
```

### Testing

```bash
pnpm test
```

## License

Apache-2.0
