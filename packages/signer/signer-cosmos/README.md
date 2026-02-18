# Ledger Cosmos Signer Implementation

This module provides the implementation of the Ledger Cosmos signer of the Device Management Kit. It enables interaction with the Cosmos application on a Ledger device including:

- Retrieving the Cosmos address using a given derivation path and HRP (Human-Readable Part);
- Signing a Cosmos transaction;
- Retrieving the app configuration;

## 🔹 Index

1. [How it works](#-how-it-works)
2. [Installation](#-installation)
3. [Initialisation](#-initialisation)
4. [Use Cases](#-use-cases)
   - [Get Address](#use-case-1-get-address)
   - [Sign Transaction](#use-case-2-sign-transaction)
   - [Get App Configuration](#use-case-3-get-app-configuration)
5. [Observable Behavior](#-observable-behavior)
6. [Example](#-example)

## 🔹 How it works

The Ledger Cosmos Signer utilizes the advanced capabilities of the Ledger device to provide secure operations for end users. It takes advantage of the interface provided by the Device Management Kit to establish communication with the Ledger device and execute various operations. The communication with the Ledger device is performed using [APDU](https://en.wikipedia.org/wiki/Smart_card_application_protocol_data_unit)s (Application Protocol Data Units), which are encapsulated within the `Command` object. These commands are then organized into tasks, allowing for the execution of complex operations with one or more APDUs. The tasks are further encapsulated within `DeviceAction` objects to handle different real-world scenarios. Finally, the Signer exposes dedicated and independent use cases that can be directly utilized by end users.

## 🔹 Installation

> **Note:** This module is not standalone; it depends on the [@ledgerhq/device-management-kit](https://github.com/LedgerHQ/device-sdk-ts/tree/develop/packages/device-management-kit) package, so you need to install it first.

To install the `device-signer-kit-cosmos` package, run the following command:

```sh
npm install @ledgerhq/device-signer-kit-cosmos
```

## 🔹 Initialisation

To initialise a Cosmos signer instance, you need a Ledger Device Management Kit instance and the ID of the session of the connected device. Use the `SignerCosmosBuilder`:

```typescript
const signerCosmos = new SignerCosmosBuilder({ dmk, sessionId }).build();
```

## 🔹 Use Cases

The `SignerCosmosBuilder.build()` method will return a `SignerCosmos` instance that exposes 3 dedicated methods, each of which calls an independent use case. Each use case will return an object that contains an observable and a method called `cancel`.

---

### Use Case 1: Get Address

This method allows users to retrieve the Cosmos address based on a given `derivationPath` and `hrp` (Human-Readable Part, e.g. `"cosmos"` for Cosmos Hub, `"osmosis"` for Osmosis).

```typescript
const { observable, cancel } = signerCosmos.getAddress(
  derivationPath,
  hrp,
  options,
);
```

#### **Parameters**

- `derivationPath`

  - **Required**
  - **Type:** `string` (e.g., `"44'/118'/0'/0/0"`)
  - The derivation path used for the Cosmos address. See [here](https://www.ledger.com/blog/understanding-crypto-addresses-and-derivation-paths) for more information.

- `hrp`

  - **Required**
  - **Type:** `string` (e.g., `"cosmos"`, `"osmosis"`)
  - The Human-Readable Part that identifies the Cosmos chain (used for bech32 encoding of the address).

- `options`

  - Optional
  - Type: `AddressOptions`

    ```typescript
    type AddressOptions = {
      checkOnDevice?: boolean;
      skipOpenApp?: boolean;
    };
    ```

  - `checkOnDevice`: An optional boolean indicating whether user confirmation on the device is required (`true`) or not (`false`).
  - `skipOpenApp`: An optional boolean indicating whether to skip opening the Cosmos app on the device (`true`) or not (`false`). Use when the app is already open.

#### **Returns**

- `observable` Emits DeviceActionState updates, including the following details:

```typescript
type PubKey = {
  publicKey: Uint8Array;
  address: string; // Bech32 address
};
```

- `cancel` A function to cancel the action on the Ledger device.

---

### Use Case 2: Sign Transaction

Securely sign a Cosmos transaction on Ledger devices.

```typescript
const { observable, cancel } = signerCosmos.signTransaction(
  derivationPath,
  hrp,
  transaction,
  options,
);
```

#### **Parameters**

- `derivationPath`

  - **Required**
  - **Type:** `string` (e.g., `"44'/118'/0'/0/0"`)
  - The derivation path used for the Cosmos address. See [here](https://www.ledger.com/blog/understanding-crypto-addresses-and-derivation-paths) for more information.

- `hrp`

  - **Required**
  - **Type:** `string` (e.g., `"cosmos"`, `"osmosis"`)
  - The Human-Readable Part that identifies the Cosmos chain (used for bech32 encoding of the address).

- `transaction`

  - **Required**
  - **Type:** `Uint8Array`
  - The serialized transaction bytes to sign.

- `options`

  - Optional
  - Type: `TransactionOptions`

    ```typescript
    type TransactionOptions = {
      skipOpenApp?: boolean;
    };
    ```

  - `skipOpenApp`: An optional boolean indicating whether to skip opening the Cosmos app on the device (`true`) or not (`false`). Use when the app is already open.

#### **Returns**

- `observable` Emits DeviceActionState updates, including the following details:

```typescript
type Signature = Uint8Array;
```

- `cancel` A function to cancel the action on the Ledger device.

---

### Internal Flow

Under the hood, this method subscribes to an  
`Observable<DeviceActionState<SignTransactionCommandResponse, SignTransactionDAError, SignTransactionDAIntermediateValue>>`.

#### DeviceActionState

Represents the lifecycle of a device action:

```typescript
type DeviceActionState<Output, Error, IntermediateValue> =
  | { status: DeviceActionStatus.NotStarted }
  | { status: DeviceActionStatus.Pending; intermediateValue: IntermediateValue }
  | { status: DeviceActionStatus.Stopped }
  | { status: DeviceActionStatus.Completed; output: Output }
  | { status: DeviceActionStatus.Error; error: Error };

enum DeviceActionStatus {
  NotStarted = "not-started",
  Pending = "pending",
  Stopped = "stopped",
  Completed = "completed",
  Error = "error",
}
```

- **NotStarted** → Action hasn't begun.
- **Pending** → Waiting for user confirmation on the device.  
  Includes an `intermediateValue` of type `SignTransactionDAIntermediateValue`.
- **Stopped** → Action was cancelled before completion.
- **Completed** → Provides the signature (`SignTransactionCommandResponse`).
- **Error** → The device or signing operation failed (`SignTransactionDAError`).

---

### Use Case 3: Get App Configuration

This method allows the user to fetch the current app configuration.

```typescript
const { observable, cancel } = signerCosmos.getAppConfig();
```

#### **Returns**

- `observable` Emits DeviceActionState updates, including the following details:

```typescript
type AppConfig = {
  major: number;
  minor: number;
  patch: number;
};
```

- `cancel` A function to cancel the action on the Ledger device.

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

## 🔹 Example

We encourage you to explore the Cosmos Signer by trying it out in our online [sample application](https://app.devicesdk.ledger-test.com/). Experience how it works and see its capabilities in action. Of course, you will need a Ledger device connected.
