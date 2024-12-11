# Ledger Near Signer Implementation

## Introduction

This module provides the implementation of the Ledger Near signer of the Device Management Kit. It enables interaction with the Near application on a Ledger device including:

- Retrieving the Near address using a given derivation path;
- Signing a Near transaction;
- Signing an offchain message displayed on a Ledger device;
- Retreiving the app configuration;

### How it works

The Ledger Near Signer utilizes the advanced capabilities of the Ledger device to provide secure operations for end users. It takes advantage of the interface provided by the Device Management Kit to establish communication with the Ledger device and execute various operations. The communication with the Ledger device is performed using [APDU](https://en.wikipedia.org/wiki/Smart_card_application_protocol_data_unit)s (Application Protocol Data Units), which are encapsulated within the `Command` object. These commands are then organized into tasks, allowing for the execution of complex operations with one or more APDUs. The tasks are further encapsulated within `DeviceAction` objects to handle different real-world scenarios. Finally, the Signer exposes dedicated and independent use cases that can be directly utilized by end users.

### Installation

> **Note:** This module is not standalone; it depends on the [@ledgerhq/device-management-kit](https://github.com/LedgerHQ/device-sdk-ts/tree/develop/packages/device-management-kit) package, so you need to install it first.

To install the `device-signer-kit-near` package, run the following command:

```sh
npm install @ledgerhq/device-signer-kit-near
```

## Usage

### Setting up

To initialize a Near signer instance, you need a Ledger Device Management Kit instance and the ID of the session of the connected device. Use the `SignerNearBuilder`

```typescript
// Initialize a Near signer instance
const signerNear = new SignerNearBuilder({ sdk, sessionId }).build();
```

### Use Cases

The `SignerNearBuilder.build()` method will return a `SignerNear` instance that exposes 4 dedicated methods, each of which calls an independent use case. Each use case will return an object that contains an observable and a method called `cancel`.

#### Use Case 1: Get public key

This method allows users to retrieve the Near wallet id according to given `derivationPath`.

```typescript
const { observable, cancel } = signerNear.getPublicKey(derivationPath, options);
```

**Parameters**

- `derivationPath`

  - **Required**
  - **Type:** `string` (e.g., `"44'/397'/0'/0'/1"`)
  - The derivation path used for the Near address. See [here](https://www.ledger.com/blog/understanding-crypto-addresses-and-derivation-paths) for more information.

- `options`

  - Optional
  - Type: `AddressOptions`

    ```typescript
    type AddressOptions = {
      checkOnDevice?: boolean;
    };
    ```

  - `checkOnDevice`: An optional boolean indicating whether user confirmation on the device is required (`true`) or not (`false`).

**Returns**

- `observable`

  - An [Observable](https://rxjs.dev/guide/observable) object that contains the [`DeviceActionState`](https://github.com/LedgerHQ/device-sdk-ts/blob/develop/packages/device-management-kit/src/api/device-action/model/DeviceActionState.ts) derived instance, which represents the operation's state. For example:

    ```typescript
    const { requiredUserInteraction } = intermediateValue;

    switch (requiredUserInteraction) {
      case UserInteractionRequired.VerifyAddress: {
        // User needs to verify the address displayed on the device
        console.log(
          "User needs to verify the address displayed on the device.",
        );
        break;
      }
      case UserInteractionRequired.None: {
        // No user action required
        console.log("No user action needed.");
        break;
      }
      case UserInteractionRequired.UnlockDevice: {
        // User needs to unlock the device
        console.log("The user needs to unlock the device.");
        break;
      }
      case UserInteractionRequired.ConfirmOpenApp: {
        // User needs to confirm on the device to open the app
        console.log("The user needs to confirm on the device to open the app.");
        break;
      }
      default:
        // Type guard to ensure all cases are handled
        const uncaughtUserInteraction: never = requiredUserInteraction;
        console.error(
          "Unhandled user interaction case:",
          uncaughtUserInteraction,
        );
    }
    ```

  - When the action status is `DeviceActionStatus.Pending`, the state will include an `intermediateValue` object that provides useful information for interaction:

  ```typescript
  const { requiredUserInteraction } = intermediateValue;

  switch (requiredUserInteraction) {
    case UserInteractionRequired.VerifyAddress: {
      // User needs to verify the address displayed on the device
      console.log("User needs to verify the address displayed on the device.");
      break;
    }
    case UserInteractionRequired.None: {
      // No user action required
      console.log("No user action needed.");
      break;
    }
    case UserInteractionRequired.UnlockDevice: {
      // User needs to unlock the device
      console.log("The user needs to unlock the device.");
      break;
    }
    case UserInteractionRequired.ConfirmOpenApp: {
      // User needs to confirm on the device to open the app
      console.log("The user needs to confirm on the device to open the app.");
      break;
    }
    default:
      // Type guard to ensure all cases are handled
      const uncaughtUserInteraction: never = requiredUserInteraction;
      console.error(
        "Unhandled user interaction case:",
        uncaughtUserInteraction,
      );
  }
  ```

  - When the action status is `DeviceActionStatus.Completed`, the execution result can be accessed through the `output` property in the state. The `output` property is of type `{ walletId: Uint8Array }`.

    ```typescript
    type PublicKey = string;
    ```

- `cancel`
  - The function without a return value to cancel the action on the Ledger device.

#### Use Case 2: Sign Transaction

This method enables users to securely sign transactions using the Ledger device.

```typescript
const { observable, cancel } = signerNear.signTransaction(
  derivationPath,
  options,
);
```

**Parameters**

- `derivationPath`

  - **Required**
  - **Type:** `string` (e.g., `"44'/397'/0'/0'/1"`)
  - The derivation path used in the transaction. See [here](https://www.ledger.com/blog/understanding-crypto-addresses-and-derivation-paths) for more information.

- `options`

  - **Required**
  - **Type:** `TransactionOptions`
  - The options for transaction

    ```typescript
    import { Action } from "@near-js/transactions";
        
    type TransactionOptions = {
      inspect?: boolean;
      nonce: bigint;
      signerId: string;
      receiverId: string;
      actions: Action[];
      blockHash: Uint8Array;
    };
    ```

**Returns**

- `observable`

  - An [Observable](https://rxjs.dev/guide/observable) object that contains the [`DeviceActionState`](https://github.com/LedgerHQ/device-sdk-ts/blob/develop/packages/device-management-kit/src/api/device-action/model/DeviceActionState.ts) derived instance which reprensents the operation's state. For example:

    ```typescript
    observable.subscribe({
      next: (state: SignTransactionDAState) => {
        switch (state.status) {
          case DeviceActionStatus.NotStarted: {
            console.log("The action is not started yet.");
            break;
          }
          case DeviceActionStatus.Pending: {
            const {
              intermediateValue: { requiredUserInteraction },
            } = state;
            // Access the intermediate value here, explained below
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
            // Access the output of the completed action here
            console.log("The action has been completed: ", output);
            break;
          }
          case DeviceActionStatus.Error: {
            const { error } = state;
            // Access the error here if occured
            console.log("An error occured during the action: ", error);
            break;
          }
        }
      },
    });
    ```

  - When the action status is `DeviceActionStatus.Pending`, the state will include an `intermediateValue` object that provides useful information for interaction:

    ```typescript
    const { requiredUserInteraction } = intermediateValue;

    switch (requiredUserInteraction) {
      case UserInteractionRequired.SignTransaction: {
        // User needs to sign the transaction displayed on the device
        console.log(
          "User needs to sign the transaction displayed on the device.",
        );
        break;
      }
      case UserInteractionRequired.None: {
        // No user action required
        console.log("No user action needed.");
        break;
      }
      case UserInteractionRequired.UnlockDevice: {
        // User needs to unlock the device
        console.log("The user needs to unlock the device.");
        break;
      }
      case UserInteractionRequired.ConfirmOpenApp: {
        // User needs to confirm on the device to open the app
        console.log("The user needs to confirm on the device to open the app.");
        break;
      }
      default:
        // Type guard to ensure all cases are handled
        const uncaughtUserInteraction: never = requiredUserInteraction;
        console.error(
          "Unhandled user interaction case:",
          uncaughtUserInteraction,
        );
    }
    ```

  - When the action status is `DeviceActionStatus.Completed`, the execution result can be accessed through the `output` property in the state. This property is a `Signature` object with the following structure:

    ```typescript
    type Signature = Uint8Array;
    ```

- `cancel`
  - The function without a return value to cancel the action on the Ledger device.

#### Use Case 3: Sign Message

This method allows users to sign a text string that is displayed on Ledger devices.

```typescript
const { observable, cancel } = signerNear.signMessage(derivationPath, message);
```

**Parameters**

- `derivationPath`

  - **Required**
  - **Type:** `string` (e.g., `"44'/397'/0'/0'/1"`)
  - The derivation path used by the Near message. See [here](https://www.ledger.com/blog/understanding-crypto-addresses-and-derivation-paths) for more information.

- `message`

  - **Required**
  - **Type:** `string`
  - The message to be signed, which will be displayed on the Ledger device.

**Returns**

- `observable`

  - An [Observable](https://rxjs.dev/guide/observable) object that contains the [`DeviceActionState`](https://github.com/LedgerHQ/device-sdk-ts/blob/develop/packages/device-management-kit/src/api/device-action/model/DeviceActionState.ts) derived instance which reprensents the operation's state. For example:

    ```typescript
    observable.subscribe({
      next: (state: SignPersonalMessageDAState) => {
        switch (state.status) {
          case DeviceActionStatus.NotStarted: {
            console.log("The action is not started yet.");
            break;
          }
          case DeviceActionStatus.Pending: {
            const {
              intermediateValue: { requiredUserInteraction },
            } = state;
            // Access the intermediate value here, explained below
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
            // Access the output of the completed action here
            console.log("The action has been completed: ", output);
            break;
          }
          case DeviceActionStatus.Error: {
            const { error } = state;
            // Access the error here if occured
            console.log("An error occured during the action: ", error);
            break;
          }
        }
      },
    });
    ```

  - When the action status is `DeviceActionStatus.Pending`, the state will include an `intermediateValue` object that provides useful information for interaction:

    ```typescript
    const { requiredUserInteraction } = intermediateValue;

    switch (requiredUserInteraction) {
      case UserInteractionRequired.SignPersonalMessage: {
        // User needs to sign the message displayed on the device
        console.log("User needs to sign the message displayed on the device.");
        break;
      }
      case UserInteractionRequired.None: {
        // No user action required
        console.log("No user action needed.");
        break;
      }
      case UserInteractionRequired.UnlockDevice: {
        // User needs to unlock the device
        console.log("The user needs to unlock the device.");
        break;
      }
      case UserInteractionRequired.ConfirmOpenApp: {
        // User needs to confirm on the device to open the app
        console.log("The user needs to confirm on the device to open the app.");
        break;
      }
      default:
        // Type guard to ensure all cases are handled
        const uncaughtUserInteraction: never = requiredUserInteraction;
        console.error(
          "Unhandled user interaction case:",
          uncaughtUserInteraction,
        );
    }
    ```

  - When the action status is `DeviceActionStatus.Completed`, the execution result can be accessed through the `output` property in the state. This property is a `Signature` object with the following structure:

    ```typescript
    type Signature = Uint8Array;
    ```

- `cancel`
  - The function without a return value to cancel the action on the Ledger device.

#### Use Case 4: Get App Configuration

This method allow the user to fetch the current app configuration.

```typescript
const { observable, cancel } = signerNear.getAppConfiguration();
```

**Returns**

- `observable`

  - An [Observable](https://rxjs.dev/guide/observable) object that contains the [`DeviceActionState`](https://github.com/LedgerHQ/device-sdk-ts/blob/develop/packages/device-management-kit/src/api/device-action/model/DeviceActionState.ts) derived instance which reprensents the operation's state. For example:

    ```typescript
    observable.subscribe({
      next: (state: SignTypedDataDAState) => {
        switch (state.status) {
          case DeviceActionStatus.NotStarted: {
            console.log("The action is not started yet.");
            break;
          }
          case DeviceActionStatus.Pending: {
            const { intermediateValue } = state;
            // Access the intermediate value here, explained below
            console.log(
              "The action is pending and the intermediate value is: ",
              requiredUserInteraction,
            );
            break;
          }
          case DeviceActionStatus.Stopped: {
            console.log("The action has been stopped.");
            break;
          }
          case DeviceActionStatus.Completed: {
            const { output } = state;
            // Access the output of the completed action here, explained below
            console.log("The action has been completed: ", output);
            break;
          }
          case DeviceActionStatus.Error: {
            const { error } = state;
            // Access the error here if occured
            console.log("An error occured during the action: ", error);
            break;
          }
        }
      },
    });
    ```

  - When the action status is `DeviceActionStatus.Pending`, the state will include an `intermediateValue` object that provides useful information for interaction:

    ```typescript
    const { requiredUserInteraction } = intermediateValue;

    switch (requiredUserInteraction) {
      case UserInteractionRequired.SignTypedData: {
        // User needs to sign the typed data displayed on the device
        console.log(
          "User needs to sign the typed data displayed on the device.",
        );
        break;
      }
      case UserInteractionRequired.None: {
        // No user action required
        console.log("No user action needed.");
        break;
      }
      case UserInteractionRequired.UnlockDevice: {
        // User needs to unlock the device
        console.log("The user needs to unlock the device.");
        break;
      }
      case UserInteractionRequired.ConfirmOpenApp: {
        // User needs to confirm on the device to open the app
        console.log("The user needs to confirm on the device to open the app.");
        break;
      }
      default:
        // Type guard to ensure all cases are handled
        const uncaughtUserInteraction: never = requiredUserInteraction;
        console.error(
          "Unhandled user interaction case:",
          uncaughtUserInteraction,
        );
    }
    ```

  - When the action status is `DeviceActionStatus.Completed`, the execution result can be accessed through the `output` property in the state. This property is a `Signature` object with the following structure:

    ```typescript
    type AppConfiguration = {
      blindSigningEnabled: boolean;
      pubKeyDisplayMode: PublicKeyDisplayMode;
      version: string;
    };
    ```

- `cancel`
  - The function without a return value to cancel the action on the Ledger device.

## Example

We encourage you to explore the Near Signer by trying it out in our online [sample application](https://app.devicesdk.ledger-test.com/). Experience how it works and see its capabilities in action. Of course, you will need a Ledger device connected.
