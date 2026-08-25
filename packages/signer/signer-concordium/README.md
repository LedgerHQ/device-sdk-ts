# Ledger Concordium Signer Implementation

This module provides the implementation of the Ledger Concordium signer of the Device Management Kit. It enables interaction with the Concordium application on a Ledger device including:

- Querying the device app configuration and version;
- Retrieving the Concordium public key using a given derivation path;
- Signing a Concordium transaction (Transfer, TransferWithMemo and TokenUpdate / PLT);
- Signing a Concordium credential deployment transaction;
- Verifying a Concordium address on-device using a trusted backend;

## 🔹 Index

1. [How it works](#-how-it-works)
2. [Installation](#-installation)
3. [Initialisation](#-initialisation)
4. [Use Cases](#-use-cases)
   - [Get App Configuration](#use-case-1-get-app-configuration)
   - [Get Public Key](#use-case-2-get-public-key)
   - [Sign Transaction](#use-case-3-sign-transaction)
   - [Sign Credential Deployment Transaction](#use-case-4-sign-credential-deployment-transaction)
   - [Verify Address](#use-case-5-verify-address)
5. [Observable Behavior](#-observable-behavior)

## 🔹 How it works

The Ledger Concordium Signer utilizes the advanced capabilities of the Ledger device to provide secure operations for end users. It takes advantage of the interface provided by the Device Management Kit to establish communication with the Ledger device and execute various operations. The communication with the Ledger device is performed using [APDU](https://en.wikipedia.org/wiki/Smart_card_application_protocol_data_unit)s (Application Protocol Data Units), which are encapsulated within the `Command` object. These commands are then organized into tasks, allowing for the execution of complex operations with one or more APDUs. The tasks are further encapsulated within `DeviceAction` objects to handle different real-world scenarios. Finally, the Signer exposes dedicated and independent use cases that can be directly utilized by end users.

## 🔹 Installation

> **Note:** This module is not standalone; it depends on the [@ledgerhq/device-management-kit](https://github.com/LedgerHQ/device-sdk-ts/tree/develop/packages/device-management-kit) package, so you need to install it first.

To install the `device-signer-kit-concordium` package, run the following command:

```sh
npm install @ledgerhq/device-signer-kit-concordium
```

## 🔹 Initialisation

To initialise a Concordium signer instance, you need a Ledger Device Management Kit instance and the ID of the session of the connected device. Use the `SignerConcordiumBuilder`:

```typescript
const signerConcordium = new SignerConcordiumBuilder({
  dmk,
  sessionId,
}).build();
```

The builder creates a default `ContextModule` out of the box, which is used by `verifyAddress` to communicate with the trusted metadata service. You can also provide a customized context module:

```typescript
import {
  ContextModuleBuilder,
  ContextModuleChainID,
} from "@ledgerhq/context-module";

const customContextModule = new ContextModuleBuilder({ originToken })
  .setChain(ContextModuleChainID.Concordium)
  .build();

const signerConcordium = new SignerConcordiumBuilder({
  dmk,
  sessionId,
})
  .withContextModule(customContextModule)
  .build();
```

## 🔹 Use Cases

The `SignerConcordiumBuilder.build()` method will return a `SignerConcordium` instance that exposes 5 dedicated methods, each of which calls an independent use case. Each use case will return an object that contains an observable and a method called `cancel`.

---

### Use Case 1: Get App Configuration

This method allows users to query the Concordium app version running on the device.

> **Note:** This command is supported starting from app-concordium `5.4.1`. Older app-concordium versions will return an `INS_NOT_SUPPORTED` (`0x6D00`) error.

```typescript
const { observable, cancel } = signerConcordium.getAppConfiguration();
```

#### **Parameters**

None.

#### **Returns**

- `observable` Emits DeviceActionState updates, including the following details:

```typescript
type AppConfiguration = {
  version: string; // e.g. "5.5.0"
};
```

- `cancel` A function to cancel the action on the Ledger device.

---

### Use Case 2: Get Public Key

This method allows users to retrieve the Concordium Ed25519 public key based on a given `derivationPath`.

```typescript
const { observable, cancel } = signerConcordium.getPublicKey(
  derivationPath,
  options,
);
```

#### **Parameters**

- `derivationPath`

  - **Required**
  - **Type:** `string` (e.g., `"44'/919'/0'/0'/0'"`)
  - The derivation path used for the Concordium key. Concordium uses hardened paths: `44'/919'/account'/identity'/credential'`.

- `options`

  - Optional
  - Type: `PublicKeyOptions`

    ```typescript
    type PublicKeyOptions = {
      checkOnDevice?: boolean;
      skipOpenApp?: boolean;
    };
    ```

  - `checkOnDevice`: An optional boolean indicating whether user confirmation on the device is required (`true`) or not (`false`).
  - `skipOpenApp`: An optional boolean indicating whether to skip opening the Concordium app on the device.

#### **Returns**

- `observable` Emits DeviceActionState updates, including the following details:

```typescript
type PublicKey = {
  publicKey: Uint8Array; // 32-byte Ed25519 public key
};
```

- `cancel` A function to cancel the action on the Ledger device.

---

### Use Case 3: Sign Transaction

Securely sign a Concordium transaction on Ledger devices. The transaction kind is detected automatically from the kind byte at offset 60 of the serialized payload.

| Kind             | Byte          | Name                                 |
| ---------------- | ------------- | ------------------------------------ |
| Transfer         | `3` (`0x03`)  | Plain CCD transfer                   |
| TransferWithMemo | `22` (`0x16`) | CCD transfer with a memo             |
| TokenUpdate      | `27` (`0x1B`) | Protocol Level Token (PLT) operation |

Any other kind byte is rejected with `UnsupportedTransactionTypeError` (errorCode `"unsupported_transaction_type"`) before anything is sent to the device.

```typescript
const { observable, cancel } = signerConcordium.signTransaction(
  derivationPath,
  transaction,
  maxFee,
  options,
);
```

#### **Parameters**

- `derivationPath`

  - **Required**
  - **Type:** `string` (e.g., `"44'/919'/0'/0'/0'"`)
  - The derivation path used for the signing key.

- `transaction`

  - **Required**
  - **Type:** `Uint8Array`
  - The serialized transaction bytes to sign. The transaction kind is detected automatically from the kind byte at offset 60.
  - For **TokenUpdate (PLT)** the expected layout is flat:

    ```text
    [header:60][kind:1 = 0x1B][token_id_length:1][token_id:1..128][cbor_total_length:4 BE][cbor:N]
    ```

    This matches the serialization produced by the official Concordium JS SDK: a token id with a word8 length prefix, followed by the operations payload with a word32 length prefix.

    The signer streams this to the device as one INIT frame carrying everything up to and including `cbor_total_length`, then CONT frames carrying the CBOR payload. Chunking is byte-oriented, so a CBOR field may span a frame boundary.

    The CBOR payload is passed through **opaque**. The signer does not decode or validate PLT semantics — the operation type, amount, recipient and memo are parsed and displayed by the device app. The signer checks only the framing: `token_id_length` within `1..128`, `cbor_total_length` within `1..512` and consistent with the remaining byte count. A layout failure is reported as `InvalidPltTransactionError` (errorCode `"invalid_plt_transaction"`) with the offending field named in the message, before any APDU is sent.

- `maxFee`

  - **Required**
  - **Type:** `bigint` (µCCD)
  - The max-fee value to display, as a uint64 in µCCD. Rendered on-device alongside the recipient and amount. The value is **display-only**: it is not part of the canonical signed bytes, so the on-chain transaction hash is unaffected.
  - Requires Concordium app version **5.6.0 or newer** on the device. On older firmware the value is dropped at the wire boundary and the device falls back to the legacy display. Signing still succeeds; only the on-device display degrades. Callers should always pass a real value; do not gate on detected firmware version.
  - **Ignored for TokenUpdate (PLT) transactions.** The device displays no fee for `INS 0x27`, and the handler rejects both a non-zero P2 and any trailing fee suffix. The value is still validated for range, so pass `0n` unless you have a real figure.
  - Invalid values (non-bigint, negative, or above uint64 range) are rejected with `InvalidMaxFeeError` (errorCode `"invalid_max_fee"`).

- `options`

  - Optional
  - Type: `TransactionOptions`

    ```typescript
    type TransactionOptions = {
      skipOpenApp?: boolean;
    };
    ```

  - `skipOpenApp`: An optional boolean indicating whether to skip opening the Concordium app on the device.

#### **PLT app-version requirement**

PLT signing requires a Concordium app that implements `INS 0x27`, currently **5.7.0 or newer**. The signer checks the running app version before sending anything and rejects an older app with `UnsupportedAppVersionError` (errorCode `"unsupported_app_version"`). This is deliberately distinct from a signing failure, so an integrator can prompt the user to update the app rather than reporting a failed transaction. Transfer and TransferWithMemo are unaffected and keep working on older apps.

#### **PLT status words**

Device-originated errors on the PLT path are surfaced via `DeviceActionStatus.Error` and discriminated by the `errorCode` string:

| `errorCode` | Meaning                                                                    | Integrator action                         |
| ----------- | -------------------------------------------------------------------------- | ----------------------------------------- |
| `"6b00"`    | P2 was not `0x00`                                                          | Signer bug; report it                     |
| `"6b01"`    | INIT sent twice, or CONT before INIT                                       | Signer bug; report it                     |
| `"6b02"`    | Derivation path invalid or deeper than 8 nodes                             | Correct the derivation path               |
| `"6b03"`    | P1 was neither `0x00` nor `0x01`                                           | Signer bug; report it                     |
| `"6b04"`    | Kind byte was not `27`, or the header is too short                         | Correct the serialized transaction        |
| `"6b06"`    | Display formatting overflow                                                | Report with the payload that triggered it |
| `"6b07"`    | Device crypto initialisation failed                                        | Retry; escalate if persistent             |
| `"6b0d"`    | Empty CONT frame, CBOR overflow, or a CBOR payload the device cannot parse | Check the CBOR against CIS-7              |
| `"6b0e"`    | `cbor_total_length` is `0` or above `512`                                  | Reduce the payload                        |
| `"6b0f"`    | `token_id_length` outside `1..128`                                         | Correct the token id                      |
| `"6b10"`    | The CBOR array carries more than one operation                             | Send one operation per transaction        |

The device accepts exactly **one** operation per PLT transaction. Batching several into the outer CBOR array is refused with `"6b10"`, so that the user cannot approve a screen showing only part of what they are signing.

The generic codes apply here too: `"6985"` user rejected, `"5515"` locked device, `"6d00"` the app does not implement `INS 0x27`.

#### **Returns**

- `observable` Emits DeviceActionState updates, including the following details:

```typescript
type Signature = Uint8Array; // 64-byte Ed25519 signature
```

- `cancel` A function to cancel the action on the Ledger device.

---

### Use Case 4: Sign Credential Deployment Transaction

Sign a credential deployment transaction on Ledger devices. Credential deployment is required before an account can send its first transaction on the Concordium blockchain. The signer parses the serialized credential deployment bytes and orchestrates the multi-step APDU sequence with the device.

```typescript
const { observable, cancel } =
  signerConcordium.signCredentialDeploymentTransaction(
    derivationPath,
    transaction,
    options,
  );
```

#### **Parameters**

- `derivationPath`

  - **Required**
  - **Type:** `string` (e.g., `"44'/919'/0'/0'/0'"`)
  - The derivation path used for the signing key.

- `transaction`

  - **Required**
  - **Type:** `Uint8Array`
  - The serialized credential deployment bytes. The wire format contains credential values, identity ownership proofs, and expiry, concatenated in the order expected by the Concordium device app.

- `options`

  - Optional
  - Type: `TransactionOptions`

    ```typescript
    type TransactionOptions = {
      skipOpenApp?: boolean;
    };
    ```

  - `skipOpenApp`: An optional boolean indicating whether to skip opening the Concordium app on the device.

#### **Returns**

- `observable` Emits DeviceActionState updates, including the following details:

```typescript
type Signature = Uint8Array; // 64-byte Ed25519 signature
```

- `cancel` A function to cancel the action on the Ledger device.

---

### Use Case 5: Verify Address

Securely verify a Concordium account address on the Ledger device using the trusted backend pattern. The signer fetches a signed account ownership descriptor from the trusted metadata service, loads it onto the device via the PKI infrastructure, then triggers address verification. The device validates the descriptor's signature chain, derives the public key from the given path, and displays the address for user confirmation only if the key matches.

The flow can fail in two distinct ways at the metadata-service boundary. Both are surfaced via `DeviceActionStatus.Error` and must be discriminated by the stable `errorCode` string on the emitted error:

- **`errorCode: "address_verification_failed"`** — the trusted metadata service was reached and actively refused the pubkey → address mapping (HTTP 4xx, typically 422). The backend's `message` is forwarded verbatim in `error.message`. Treat as a terminal, non-retryable verification failure.
- **`errorCode: "trusted_metadata_service_error"`** — the trusted metadata service could not answer (network failure, HTTP 5xx, malformed response). Treat as transient; a retry or a cached-address fallback may be appropriate.

Device-originated errors (`"6985"` user rejected, `"5515"` locked device, `"6b0c"` trusted name mismatch) are surfaced the same way.

```typescript
const { observable, cancel } = signerConcordium.verifyAddress(
  derivationPath,
  address,
  network,
  options,
);
```

#### **Parameters**

- `derivationPath`

  - **Required**
  - **Type:** `string` (e.g., `"44'/919'/0'/0'/0'"`)
  - The derivation path for the account's signing key.

- `address`

  - **Required**
  - **Type:** `string`
  - The Concordium Base58Check account address to verify (e.g., `"3kFkntk2H5FGMzeR3GjQKPhdZK9LShKdPHsj2fiGKCdmDXj2WB"`).

- `network`

  - **Required**
  - **Type:** `"mainnet" | "testnet"`
  - The Concordium network for which to verify the address.

- `options`

  - Optional
  - Type: `VerifyAddressOptions`

    ```typescript
    type VerifyAddressOptions = {
      skipOpenApp?: boolean;
    };
    ```

  - `skipOpenApp`: An optional boolean indicating whether to skip opening the Concordium app on the device.

#### **Returns**

- `observable` Emits DeviceActionState updates. On completion, the output is `true` (the address was verified and approved by the user).

- `cancel` A function to cancel the action on the Ledger device.

---

## 🔹 Observable Behavior

Each method returns an [Observable](https://rxjs.dev/guide/observable) emitting updates structured as [`DeviceActionState`](https://github.com/LedgerHQ/device-sdk-ts/blob/develop/packages/device-management-kit/src/api/device-action/model/DeviceActionState.ts). These updates reflect the operation's progress and status:

- **NotStarted**: The operation hasn't started.
- **Pending**: The operation is in progress and may require user interaction.
- **Stopped**: The operation was canceled or stopped.
- **Completed**: The operation completed successfully, with results available.
- **Error**: An error occurred.

**Example Observable Subscription:**

```typescript
observable.subscribe({
  next: (state: DeviceActionState) => {
    switch (state.status) {
      case DeviceActionStatus.NotStarted: {
        console.log("The action is not started yet.");
        break;
      }
      case DeviceActionStatus.Pending: {
        const { intermediateValue } = state;
        console.log(
          "The action is pending and the intermediate value is: ",
          intermediateValue,
        );
        break;
      }
      case DeviceActionStatus.Stopped: {
        console.log("The action has been stopped.");
        break;
      }
      case DeviceActionStatus.Completed: {
        const { output } = state;
        console.log("The action has been completed: ", output);
        break;
      }
      case DeviceActionStatus.Error: {
        const { error } = state;
        console.log("An error occurred during the action: ", error);
        break;
      }
    }
  },
});
```

**Intermediate Values in Pending Status:**

When the status is DeviceActionStatus.Pending, the state will include an `intermediateValue` object that provides useful information for interaction:

```typescript
const { requiredUserInteraction } = intermediateValue;

switch (requiredUserInteraction) {
  case UserInteractionRequired.VerifyAddress: {
    console.log("User needs to verify the address displayed on the device.");
    break;
  }
  case UserInteractionRequired.SignTransaction: {
    console.log("User needs to sign the transaction displayed on the device.");
    break;
  }
  case UserInteractionRequired.ConfirmOpenApp: {
    console.log("The user needs to confirm on the device to open the app.");
    break;
  }
  case UserInteractionRequired.UnlockDevice: {
    console.log("The user needs to unlock the device.");
    break;
  }
  case UserInteractionRequired.None: {
    console.log("No user action needed.");
    break;
  }
  default:
    const uncaughtUserInteraction: never = requiredUserInteraction;
    console.error("Unhandled user interaction case:", uncaughtUserInteraction);
}
```
