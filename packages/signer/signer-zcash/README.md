# Ledger Zcash Signer Implementation

This module provides the implementation of the Ledger Zcash signer of the Device Management Kit. It enables interaction with the Zcash application on a Ledger device including:

- Retrieving a transparent Zcash address for a given derivation path;
- Retrieving a unified or Orchard full viewing key (ZIP-32 account path);
- Signing a transparent Zcash payment transaction (Ledger Wallet / `hw-app-btc` compatible shape);
- Signing an Orchard shielded (PCZT) transaction, returning per-action Orchard spend-authorization signatures and per-input transparent signatures;
- Signing a message displayed on the device;
- Fetching trusted inputs for previous transactions;
- Retrieving the app configuration;

## Index

1. [How it works](#how-it-works)
2. [Installation](#installation)
3. [Initialisation](#initialisation)
4. [Use Cases](#use-cases)
   - [Get Address](#use-case-1-get-address)
   - [Get Full Viewing Key](#use-case-2-get-full-viewing-key)
   - [Sign Transaction](#use-case-3-sign-transaction)
   - [Sign PCZT Transaction](#use-case-4-sign-pczt-transaction)
   - [Sign Message](#use-case-5-sign-message)
   - [Get Trusted Input](#use-case-6-get-trusted-input)
   - [Get App Configuration](#use-case-7-get-app-configuration)
5. [Observable Behavior](#observable-behavior)
6. [Example](#example)
7. [Development](#development)

## How it works

The Ledger Zcash Signer uses the Device Management Kit to communicate with the Zcash app on a Ledger device. Operations are sent as [APDUs](https://en.wikipedia.org/wiki/Smart_card_application_protocol_data_unit) wrapped in `Command` objects, grouped into tasks (for example `SignTransactionTask`), and exposed as device actions that return an observable plus `cancel`.

`signTransaction` follows the same high-level flow as Ledger Wallet’s `createPaymentTransaction` / `@ledgerhq/hw-app-btc`: trusted inputs for each UTXO, global transaction hashing, optional Sapling output commit, per-input signing, then assembly of the signed transaction hex.

## Installation

```bash
pnpm add @ledgerhq/device-signer-kit-zcash
```

## Initialisation

```typescript
import { SignerZcashBuilder } from "@ledgerhq/device-signer-kit-zcash";

const signerZcash = new SignerZcashBuilder({ dmk, sessionId }).build();
```

Derivation paths must **not** include an `m/` prefix. Use coin type **133'** (BIP-44 Zcash):

- **Transparent address / signing inputs:** ZIP-44 — `44'/133'/account'/change/index`
- **Full viewing key:** ZIP-32 account path — `32'/133'/account'`

## Use Cases

Each method returns `{ observable, cancel }`. Subscribe to `observable` for progress and the final result.

---

### Use Case 1: Get Address

Retrieve a transparent Zcash address and public key for a derivation path.

```typescript
const { observable, cancel } = signerZcash.getAddress("44'/133'/0'/0/0", {
  checkOnDevice: false,
  skipOpenApp: false,
});
```

#### Parameters

- `derivationPath` — **Required** — `string` (e.g. `"44'/133'/0'/0/0"`)
- `options` — Optional — `AddressOptions`

  ```typescript
  type AddressOptions = {
    checkOnDevice?: boolean;
    skipOpenApp?: boolean;
  };
  ```

#### Returns

On success, `output` includes:

```typescript
type GetAddressCommandResponse = {
  publicKey: Uint8Array;
  address: string;
  chainCode: Uint8Array;
};
```

Intermediate value may require `UserInteractionRequired.VerifyAddress` when `checkOnDevice` is true.

---

### Use Case 2: Get Full Viewing Key

Retrieve a unified full viewing key (UFVK string) or raw Orchard FVK bytes for a ZIP-32 account path.

```typescript
import { DeviceActionStatus } from "@ledgerhq/device-management-kit";

const { observable: getUfvk$ } = signerZcash.getFullViewingKey("32'/133'/0'");
getUfvk$.subscribe({
  next: (state) => {
    if (state.status === DeviceActionStatus.Completed) {
      console.log("UFVK:", state.output.fullViewingKey);
    }
  },
});

const { observable: getOrchardFvk$ } = signerZcash.getFullViewingKey(
  "32'/133'/0'",
  { mode: "orchardFvk" },
);
```

#### Parameters

- `derivationPath` — **Required** — `string` (e.g. `"32'/133'/0'"`)
- `options` — Optional — `FullViewingKeyOptions`

  ```typescript
  type FullViewingKeyOptions = {
    mode?: "ufvk" | "orchardFvk"; // default "ufvk"
    skipOpenApp?: boolean;
  };
  ```

#### Returns

```typescript
type GetFullViewingKeyResult =
  | { mode: "ufvk"; fullViewingKey: string }
  | { mode: "orchardFvk"; fullViewingKey: Uint8Array };
```

---

### Use Case 3: Sign Transaction

Sign a transparent Zcash payment transaction. The argument shape matches **`LegacyCreateTransactionArg`** (compatible with Ledger Wallet `createPaymentTransaction` and parsed `splitTransaction` output).

```typescript
import {
  type LegacyCreateTransactionArg,
  type LegacyTransaction,
} from "@ledgerhq/device-signer-kit-zcash";

const transactionArg: LegacyCreateTransactionArg = {
  inputs: [
    [
      previousTransaction, // LegacyTransaction
      1, // output index in previousTransaction.outputs
      null, // optional input script override (hex string)
      0xffffffff, // optional sequence (default 0xffffffff)
      3290695, // optional branch height for previous tx consensusBranchId
    ],
  ],
  associatedKeysets: ["44'/133'/0'/1/2"],
  changePath: "44'/133'/0'/1/3",
  outputScriptHex:
    "02a0860100000000001976a9140a773e79f573c395ebee90498d944dedd733e88988ac4a530000000000001976a91475850960de41df9ac39f04036d4a2133d13ee3e788ac",
  blockHeight: 3338721,
  lockTime: 0,
  sigHashType: 1,
  additionals: ["zcash", "sapling"],
  expiryHeight: new Uint8Array([0x00, 0x00, 0x00, 0x00]),
};

const { observable, cancel } = signerZcash.signTransaction(
  transactionArg,
  options,
);
```

#### `LegacyCreateTransactionArg`

```typescript
type LegacyCreateTransactionArg = {
  inputs: Array<
    [
      LegacyTransaction,
      number, // output index
      string | null | undefined, // optional script hex override
      number | null | undefined, // optional sequence
      number | null | undefined?, // optional branch height (previous tx)
    ]
  >;
  associatedKeysets: string[]; // one path per input; same length as inputs
  changePath?: string; // derivation path for change output (multi-output flows)
  outputScriptHex: string; // payment outputs blob (amount + scriptPubKey pairs)
  lockTime?: number; // default 0
  blockHeight?: number; // target tx height → consensus branch id
  sigHashType?: number; // default 1 (SIGHASH_ALL)
  additionals: string[]; // must include "zcash"; include "sapling" for Sapling txs
  expiryHeight?: Uint8Array; // 4 bytes; default zero for v5
};

type LegacyTransaction = {
  version: Uint8Array;
  inputs: LegacyTransactionInput[];
  outputs?: LegacyTransactionOutput[];
  locktime?: Uint8Array;
  timestamp?: Uint8Array;
  nVersionGroupId?: Uint8Array;
  nExpiryHeight?: Uint8Array;
  extraData?: Uint8Array;
  consensusBranchId?: Uint8Array;
  /**
   * Full Zcash v5 wire bytes for GET_TRUSTED_INPUT when the previous tx
   * includes Sapling/Orchard data not represented in transparent outputs.
   * Same bytes as Ledger Wallet `splitTransaction` / `transactionHex`.
   */
  serializedPreviousTransactionOverride?: Uint8Array;
};
```

#### Requirements and behavior

| Field / flag                            | Notes                                                                                                                                                            |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `additionals`                           | Must include `"zcash"` (case-insensitive). Transparent signing only.                                                                                             |
| `"sapling"` in `additionals`            | Enables Sapling output commit step and v5 `extraData` on the target transaction.                                                                                 |
| `inputs` / `associatedKeysets`          | Same length; one keyset per input to sign.                                                                                                                       |
| `outputScriptHex`                       | Concatenated varint count + `(amount \|\| scriptPubKey)` for each payment output.                                                                                |
| `changePath`                            | When set and the payment blob includes a change output matching that path’s P2PKH script, the signer sends `ProvideOutputFullChangePath` before hashing outputs. |
| `blockHeight`                           | Drives consensus branch id on the **target** transaction.                                                                                                        |
| Input tuple `[4]`                       | Optional branch height for the **previous** transaction’s consensus branch id.                                                                                   |
| `serializedPreviousTransactionOverride` | Use when transparent `outputs` are not enough to build trusted input (shielded/joined prev txs).                                                                 |

#### Internal flow (`SignTransactionTask`)

1. For each input: `GetTrustedInput` on the previous transaction (or override bytes).
2. Resolve public keys via `GetAddress` for each `associatedKeysets` entry (and optionally `changePath`).
3. `StartUntrustedHashTransactionInput` — global pass over the target transaction.
4. Optionally `ProvideOutputFullChangePath` when change is detected in `outputScriptHex`.
5. `HashOutputFull` — hash `outputScriptHex` in chunks.
6. If Sapling: `ZcashSaplingOutputCommit`.
7. Per input: second `StartUntrustedHashTransactionInput` pass, then `SignTransaction` (device prompts to approve).
8. Assemble signed transaction hex: serialized tx + `outputScriptHex` + trailing `0x000000`.

Regression vectors from Ledger Wallet exports live under  
`src/internal/app-binder/task/__fixtures__/signTransactionFromLedgerWalletLogs2026-05-*.ts`.

#### Parameters (options)

```typescript
type TransactionOptions = {
  skipOpenApp?: boolean;
};
```

#### Returns

```typescript
type SignTransactionDAOutput = HexaString; // e.g. "0x05000080..."
```

On **Pending**, `requiredUserInteraction` is `UserInteractionRequired.SignTransaction` (user must approve on device).

---

### Use Case 4: Sign PCZT Transaction

Sign an Orchard **shielded** transaction expressed as a PCZT (Partially Constructed Zcash Transaction). The host (zcash-utils) builds the PCZT and passes the structured `PcztTransaction` to the signer, which streams the header, transparent inputs/outputs, and Orchard actions to the device as the `PCZT_*` APDU sequence. The device returns the raw per-action Orchard `spendAuthSig`s and per-input transparent signatures; the **binding signature and final transaction assembly are host-side** (never involve the device). The legacy transparent [`signTransaction`](#use-case-3-sign-transaction) path is unchanged.

```typescript
import { type PcztTransaction } from "@ledgerhq/device-signer-kit-zcash";

const transaction: PcztTransaction = {
  global: {
    txVersion: 5,
    versionGroupId: 0x26a7270a,
    consensusBranchId: 0xc2d6d0b4,
    fallbackLockTime: 0, // Option<u32>; null encodes the absent tag
    expiryHeight: 0,
    coinType: 133, // 133 mainnet, 1 testnet
    txModifiable: 0,
  },
  transparentInputs: [], // may be empty (streamed with count 0)
  transparentOutputs: [],
  orchardBundle: {
    actions: [
      /* PcztOrchardAction[] */
    ],
    flags: 0x03,
    valueBalance: 0n,
    anchor: orchardAnchor, // 32 bytes
  },
};

const { observable, cancel } = signerZcash.signPcztTransaction(
  transaction,
  options,
);
```

#### `PcztTransaction`

All multi-byte integer fields are encoded little-endian on the wire, except derivation-path components (standard big-endian `Bip32Path`).

```typescript
type PcztTransaction = {
  global: PcztGlobal;
  transparentInputs: PcztTransparentInput[]; // count 0 when empty
  transparentOutputs: PcztTransparentOutput[]; // count 0 when empty
  orchardBundle: PcztOrchardBundle | null; // null = empty Orchard bundle
};

type PcztGlobal = {
  txVersion: number; // V5 = 5
  versionGroupId: number;
  consensusBranchId: number;
  fallbackLockTime: number | null; // Option<u32>; null = absent
  expiryHeight: number;
  coinType: number; // 133 mainnet, 1 testnet
  txModifiable: number;
};

type PcztBip32Derivation = {
  signingPath: string;
  pubkey: Uint8Array; // compressed secp256k1, 33 bytes
  seedFingerprint?: Uint8Array; // ZIP-32, 32 bytes (default 32 zero bytes)
};

type PcztTransparentInput = {
  prevoutTxid: Uint8Array; // 32 bytes
  prevoutIndex: number;
  sequence: number | null; // Option<u32>; null = absent
  value: bigint; // zatoshis
  scriptPubKey: Uint8Array;
  sighashType: number; // must be SIGHASH_ALL (0x01)
  derivation: PcztBip32Derivation;
};

type PcztTransparentOutput = {
  value: bigint; // zatoshis
  scriptPubKey: Uint8Array;
  derivation?: PcztBip32Derivation | null; // entry count 0 or 1
};

type PcztOrchardAction = {
  cvNet: Uint8Array; // value commitment, 32 bytes
  nullifier: Uint8Array; // spend nullifier, 32 bytes
  rk: Uint8Array; // randomized verification key, 32 bytes
  spendRecipient: Uint8Array; // raw Orchard address of spent note, 43 bytes
  spendValue: bigint; // zatoshis
  spendRho: Uint8Array; // 32 bytes
  spendRseed: Uint8Array; // 32 bytes
  alpha: Uint8Array; // spend-auth randomizer (Pallas scalar), 32 bytes; host→device only
  signingPath: string; // ZIP-32 derivation path of the signing key
  seedFingerprint?: Uint8Array; // 32 bytes (default 32 zero bytes)
  cmx: Uint8Array; // note commitment x-coord, 32 bytes
  ephemeralKey: Uint8Array; // 32 bytes
  encCiphertext: Uint8Array;
  outCiphertext: Uint8Array;
  recipient: Uint8Array; // raw Orchard address of output note, 43 bytes
  value: bigint; // output-note value, zatoshis
  rseed: Uint8Array; // 32 bytes
  rcv: Uint8Array; // randomized commitment value, 32 bytes (required)
};

type PcztOrchardBundle = {
  actions: PcztOrchardAction[];
  flags: number;
  valueBalance: bigint; // net value balance, zatoshis (signed)
  anchor: Uint8Array; // Orchard commitment-tree anchor, 32 bytes
};
```

#### Parameters (options)

```typescript
type TransactionOptions = {
  skipOpenApp?: boolean;
};
```

#### Returns

```typescript
type SignPcztTransactionResult = {
  // one spendAuthSig per Orchard action, in action order
  orchard: Array<{ spendAuthSig: Uint8Array }>; // RedPallas sig, 64 bytes each
  // one signature per transparent input, in input order:
  // DER-encoded secp256k1 signature + trailing sighash_type byte (0x01)
  transparentInputSigs: Uint8Array[];
};
```

There is **no `bindingSig`** in the result: the binding signature is computed host-side from `bsk = Σ rcv`. On **Pending**, `requiredUserInteraction` is `UserInteractionRequired.SignTransaction` (user must approve on device).

---

### Use Case 5: Sign Message

Sign a message displayed on the Ledger device.

```typescript
const { observable, cancel } = signerZcash.signMessage(
  "44'/133'/0'/0/0",
  "Hello World",
);
```

- `derivationPath` — **Required** — transparent ZIP-44 path
- `message` — **Required** — `string | Uint8Array`

---

### Use Case 6: Get Trusted Input

Low-level helper used internally by `signTransaction`; also exposed for debugging or custom flows.

```typescript
const { observable, cancel } = signerZcash.getTrustedInput(
  serializedPreviousTx,
  { indexLookup: 0, skipOpenApp: false },
);
```

- `transaction` — `Uint8Array` — full previous transaction wire bytes
- `indexLookup` — output index to spend

---

### Use Case 7: Get App Configuration

```typescript
const { observable, cancel } = signerZcash.getAppConfig();
```

---

## Observable Behavior

Each method returns an [Observable](https://rxjs.dev/guide/observable) of `DeviceActionState` values: `NotStarted`, `Pending` (with `intermediateValue`), `Stopped`, `Completed` (with `output`), or `Error`.

```typescript
import { DeviceActionStatus } from "@ledgerhq/device-management-kit";

observable.subscribe({
  next: (state) => {
    switch (state.status) {
      case DeviceActionStatus.Completed:
        console.log("Signed tx:", state.output);
        break;
      case DeviceActionStatus.Pending:
        console.log("Waiting for user:", state.intermediateValue);
        break;
      case DeviceActionStatus.Error:
        console.error(state.error);
        break;
    }
  },
});
```

## Development

```bash
# Install dependencies (from repo root)
pnpm install

# Build
pnpm --filter @ledgerhq/device-signer-kit-zcash build

# Test
pnpm --filter @ledgerhq/device-signer-kit-zcash test

# Lint
pnpm --filter @ledgerhq/device-signer-kit-zcash lint
```
