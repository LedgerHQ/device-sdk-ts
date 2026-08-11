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

// Sign a transaction hash (requires the "Sign by hash" app setting)
const { observable: hashObservable } = signer.signTransactionHash(
  "44'/195'/0'/0/0",
  transactionHash,
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

### Get app configuration

Reads the Tron app configuration from the device (version and the flags the app
was built with). No user interaction is required.

```typescript
signer.getAppConfiguration(): GetAppConfigurationDAReturnType;
```

The returned device action resolves to:

```typescript
{
  version: string; // semantic version, e.g. "0.5.0"
  versionN: number; // numeric version (major * 10000 + minor * 100 + patch)
  allowData: boolean; // "sign data" setting enabled on the device
  allowContract: boolean; // "sign custom contracts" setting enabled
  truncateAddress: boolean; // addresses are truncated on the device screen
  signByHash: boolean; // "sign by hash" setting enabled
}
```

```typescript
const { observable, cancel } = signer.getAppConfiguration();

observable.subscribe((state) => {
  switch (state.status) {
    case "completed":
      console.log(state.output.version, state.output.allowContract);
      break;
    case "error":
      console.error(state.error);
      break;
  }
});
```

### Sign transaction

Signs a raw Tron transaction. The transaction is the protobuf-serialized
`raw_data` bytes of the transaction; it is framed across APDUs, reviewed and
blind-signed on the device (no clear-signing context is resolved). Requires
the user to approve the transaction on the device screen.

```typescript
signer.signTransaction(
  derivationPath: string,
  // protobuf-serialized `raw_data` bytes of the transaction
  transaction: Uint8Array,
  options?: {
    // Skip the "open app" step if the Tron app is already open (default: false).
    skipOpenApp?: boolean;
  },
): SignTransactionDAReturnType;
```

The returned device action resolves to the 65-byte signature
(`r[32] + s[32] + v[1]`) as a `Uint8Array`.

```typescript
const { observable, cancel } = signer.signTransaction(
  "44'/195'/0'/0/0",
  rawTransaction,
);

observable.subscribe((state) => {
  switch (state.status) {
    case "completed":
      console.log(state.output); // Uint8Array(65) signature
      break;
    case "error":
      console.error(state.error);
      break;
  }
});
```

### Sign transaction hash

Signs a transaction hash directly, without transmitting (or reviewing) the
transaction itself — the device only displays the hash. Use with care: the
signer cannot verify what is being signed. Only accepted by the Tron app when
its **"Sign by hash"** setting is enabled on the device (see the `signByHash`
flag returned by `getAppConfiguration()`); otherwise the device action fails.

```typescript
signer.signTransactionHash(
  derivationPath: string,
  // the 32-byte hash of the protobuf-serialized `raw_data` of the transaction
  transactionHash: Uint8Array,
  options?: {
    // Skip the "open app" step if the Tron app is already open (default: false).
    skipOpenApp?: boolean;
  },
): SignTransactionHashDAReturnType;
```

The returned device action resolves to the 65-byte signature
(`r[32] + s[32] + v[1]`) as a `Uint8Array`.

```typescript
const { observable, cancel } = signer.signTransactionHash(
  "44'/195'/0'/0/0",
  transactionHash,
);

observable.subscribe((state) => {
  switch (state.status) {
    case "completed":
      console.log(state.output); // Uint8Array(65) signature
      break;
    case "error":
      console.error(state.error);
      break;
  }
});
```

### Sign personal message

Signs a personal (TIP-191-style) message. A `string` message is UTF-8 encoded;
raw bytes can be passed as a `Uint8Array`. The length-prefixed message is
framed across APDUs and reviewed on the device. Requires the user to approve
the message on the device screen.

```typescript
signer.signPersonalMessage(
  derivationPath: string,
  // the message to sign: a text string (UTF-8 encoded) or raw bytes
  message: string | Uint8Array,
  options?: {
    // Skip the "open app" step if the Tron app is already open (default: false).
    skipOpenApp?: boolean;
  },
): SignPersonalMessageDAReturnType;
```

The returned device action resolves to the 65-byte signature
(`r[32] + s[32] + v[1]`) as a `Uint8Array`.

```typescript
const { observable, cancel } = signer.signPersonalMessage(
  "44'/195'/0'/0/0",
  "Hello Tron",
);

observable.subscribe((state) => {
  switch (state.status) {
    case "completed":
      console.log(state.output); // Uint8Array(65) signature
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
