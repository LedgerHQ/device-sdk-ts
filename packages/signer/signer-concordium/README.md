# Ledger Concordium Signer Implementation

This module provides the implementation of the Ledger Concordium signer of the Device Management Kit. It enables interaction with the Concordium application on a Ledger device including:

- Retrieving the Concordium public key using a given derivation path;
- Signing a Concordium transaction (Transfer and TransferWithMemo);

## 🔹 Index

1. [How it works](#-how-it-works)
2. [Installation](#-installation)
3. [Initialisation](#-initialisation)
4. [Use Cases](#-use-cases)
   - [Get Public Key](#use-case-1-get-public-key)
   - [Sign Transaction](#use-case-2-sign-transaction)
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

## 🔹 Use Cases

The `SignerConcordiumBuilder.build()` method will return a `SignerConcordium` instance that exposes 2 dedicated methods, each of which calls an independent use case. Each use case will return an object that contains an observable and a method called `cancel`.

---

### Use Case 1: Get Public Key

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

### Use Case 2: Sign Transaction

Securely sign a Concordium transaction on Ledger devices. Supports both Transfer and TransferWithMemo transaction types. The transaction type is automatically detected from the serialized payload.

```typescript
const { observable, cancel } = signerConcordium.signTransaction(
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
  - The serialized transaction bytes to sign. The transaction type (Transfer or TransferWithMemo) is detected automatically from the type byte at offset 60.

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
