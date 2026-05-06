# Signer zcash

This package provides a signer implementation for zcash.

## Installation

```bash
pnpm add @ledgerhq/device-signer-kit-zcash
```

## Usage

```typescript
import { SignerZcashBuilder } from "@ledgerhq/device-signer-kit-zcash";
import { DeviceActionStatus } from "@ledgerhq/device-management-kit";

const signer = new SignerZcashBuilder({ dmk, sessionId }).build();

// Derivation paths must NOT include an "m/" prefix.
// getAddress/signTransaction use ZIP-44: 44'/133'/account'/change/index.
const { observable: getAddress$ } = signer.getAddress("44'/133'/0'/0/0");
getAddress$.subscribe({
  next: (state) => {
    if (state.status === DeviceActionStatus.Completed) {
      console.log("Address:", state.output.address);
    }
  },
});

// getFullViewingKey uses ZIP-32 account path: 32'/133'/account'.
// Default mode "ufvk": success output is { mode: "ufvk", fullViewingKey: string }.
// mode "orchardFvk": success output is { mode: "orchardFvk", fullViewingKey: Uint8Array }.
const { observable: getUfvk$ } = signer.getFullViewingKey("32'/133'/0'");
getUfvk$.subscribe({
  next: (state) => {
    if (state.status === DeviceActionStatus.Completed) {
      console.log("UFVK:", state.output.fullViewingKey);
    }
  },
});

const { observable: getOrchardFvk$ } = signer.getFullViewingKey("32'/133'/0'", {
  mode: "orchardFvk",
});
getOrchardFvk$.subscribe({
  next: (state) => {
    if (state.status === DeviceActionStatus.Completed) {
      console.log("Orchard FVK bytes:", state.output.fullViewingKey);
    }
  },
});
// When the Zcash app is already open: { skipOpenApp: true }

// Sign transaction
const { observable: signTransaction$ } = signer.signTransaction(
  "44'/133'/0'/0/0",
  transactionBytes,
);
signTransaction$.subscribe({
  next: (state) => {
    if (state.status === DeviceActionStatus.Completed) {
      console.log("Signature:", state.output);
    }
  },
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
