# Ledger Ethereum Keyring Implementation

## Introduction

This module provides the implementation of the Ledger Ethereum keyring of the Device SDK. It enables interaction with the Ethereum application on a Ledger device including:

- Retrieving the Ethereum address using a given derivation path;
- Signing an Ethereum transaction ([Clear Signing](https://www.ledger.com/academy/topics/ledgersolutions/what-is-clear-signing));
- Signing a message displayed on a Ledger device;
- Signing an [EIP-712](https://eips.ethereum.org/EIPS/eip-712) specified message.

### How it works

The Ledger Ethereum Keyring utilises the advanced capabilities of the Ledger device to provide secure operations for end users. It takes advantage of the interface provided by the Device SDK to establish communication with the Ledger device and execute various operations, including signing transactions. The communication with the Ledger device is performed using [APDU](https://en.wikipedia.org/wiki/Smart_card_application_protocol_data_unit)s (Application Protocol Data Units), which are encapsulated within the `Command` object. These commands are then organised into tasks, allowing for the execution of complex operations with one or more APDUs. The tasks are further encapsulated within `DeviceAction` objects to handle different real-world scenarios. Finally, the Keyring exposes dedicated and independent use cases that can be directly utilised by end users.

### Installation

> **Note:** This module is not standalone; it depends on the [@ledgerhq/device-sdk-core](https://github.com/LedgerHQ/device-sdk-ts/tree/develop/packages/core) package, so you need to install it first.

To install the `keyring-eth` package, run the following command:

```sh
npm install @ledgerhq/keyring-eth
```

## Usage

### Setting up

To initialise an Ethereum keyring instance, you need a Ledger device SDK instance and the ID of the session of the connected device. Use the `KeyringEthBuilder` along with the [Context Module](https://github.com/LedgerHQ/device-sdk-ts/tree/develop/packages/signer/context-module) by default developed by Ledger:

```typescript
// Initialie an Ethereum keyring instance using default context module
const keyringEth = new KeyringEthBuilder({ sdk, sessionId }).build();
```

You can also configure the context module yourself:

```typescript
// Initialise an Ethereum keyring instance using customised context module
const keyringEth = new KeyringEthBuilder({ sdk, sessionId })
  .withContextModule(customContextModule)
  .build();
```

### Use Cases

The `KeyringEthBuilder.build()` method will return a `KeyringEth` instance that exposes 4 dedicated methods, each of which calls an independent use case. Each use case will return an object that contains an observable and a method called `cancel`.

#### Use Case 1: Get Address

This method allows users to retrieve the Ethereum address according to given `derivationPath`.

```typescript
const { observable, cancel } = keyringETH.getAddress(derivationPath, options);
```

**Parameters**

- `derivationPath`

  - **Required**
  - **Type:** `string` (e.g., `"44'/60'/0'/0/0"`)
  - The derivation path used for the Ethereum address. See [here](https://www.ledger.com/blog/understanding-crypto-addresses-and-derivation-paths) for more information.

- `options`

  - Optional
  - Type: `AddressOptions`

    ```typescript
    type AddressOptions = {
      checkOnDevice?: boolean;
      returnChainCode?: boolean;
    };
    ```

  - `checkOnDevice`: An optional boolean indicating whether user confirmation on the device is required (`true`) or not (`false`).
  - `returnChainCode`: An optional boolean indicating whether the chain code should be returned (`true`) or not (`false`).

**Returns**

- `observable`

  - An [Observable](https://rxjs.dev/guide/observable) object that contains the [`DeviceActionState`](https://github.com/LedgerHQ/device-sdk-ts/blob/develop/packages/core/src/api/device-action/model/DeviceActionState.ts) derived instance, which reprensents the operation's state. For example:

    ```typescript
    observable.subscribe({
      next: (state: DeviceActionState) => {
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

  - When the action status is `DeviceActionStatus.Completed`, the execution result can be accessed through the `output` property in the state. The `output` property is of type `GetAddressCommandResponse`, which has the following structure:

    ```typescript
    type GetAddressCommandResponse = {
      publicKey: string;
      address: `0x${string}`;
      chainCode?: string;
    };
    ```

- `cancel`
  - The function without a return value to cancel the action on the Ledger device.

#### Use Case 2: Sign Transaction

This method enables users to securely sign transactions using clear signing on Ledger devices.

```typescript
const { observable, cancel } = keyringETH.signTransaction(
  derivationPath,
  transaction,
  options,
);
```

**Parameters**

- `derivationPath`

  - **Required**
  - **Type:** `string` (e.g., `"44'/60'/0'/0/0"`)
  - The derivation path used in the transaction. See [here](https://www.ledger.com/blog/understanding-crypto-addresses-and-derivation-paths) for more information.

- `transaction`

  - **Required**
  - **Type:**`Transaction` (compatible with [ethers v5](https://docs.ethers.org/v5/) or [ethers v6](https://docs.ethers.org/v6/))
  - The transaction object that needs to be signed.

- `options`

  - **Optional**
  - **Type:** `TransactionOptions`

    ```typescript
    type TransactionOptions = {
      domain?: string;
    };
    ```

  - `domain` An optional string representing the domain present in the transaction. Currently, only ENS domains are supported.

**Returns**

- `observable`

  - An [Observable](https://rxjs.dev/guide/observable) object that contains the [`DeviceActionState`](https://github.com/LedgerHQ/device-sdk-ts/blob/develop/packages/core/src/api/device-action/model/DeviceActionState.ts) derived instance which reprensents the operation's state. For example:

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
    type Signature = {
      r: `0x${string}`;
      s: `0x${string}`;
      v: number;
    };
    ```

- `cancel`
  - The function without a return value to cancel the action on the Ledger device.

#### Use Case 3: Sign Message

This method allows users to sign a text string that is displayed on Ledger devices.

```typescript
const { observable, cancel } = keyringETH.signMessage(derivationPath, message);
```

**Parameters**

- `derivationPath`

  - **Required**
  - **Type:** `string` (e.g., `"44'/60'/0'/0/0"`)
  - The derivation path used by the Ethereum message. See [here](https://www.ledger.com/blog/understanding-crypto-addresses-and-derivation-paths) for more information.

- `message`

  - **Required**
  - **Type:** `string`
  - The message to be signed, which will be displayed on the Ledger device.

**Returns**

- `observable`

  - An [Observable](https://rxjs.dev/guide/observable) object that contains the [`DeviceActionState`](https://github.com/LedgerHQ/device-sdk-ts/blob/develop/packages/core/src/api/device-action/model/DeviceActionState.ts) derived instance which reprensents the operation's state. For example:

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
    type Signature = {
      r: `0x${string}`;
      s: `0x${string}`;
      v: number;
    };
    ```

- `cancel`
  - The function without a return value to cancel the action on the Ledger device.

#### Use Case 4: Sign TypedData

This method enables users to sign an Ethereum message following the [EIP-712](https://eips.ethereum.org/EIPS/eip-712) specification.

```typescript
const { observable, cancel } = keyringETH.signTypedData(
  derivationPath,
  typedData,
);
```

**Parameters**

- `derivationPath`

  - **Required**
  - **Type:** `string` (e.g., `"44'/60'/0'/0/0"`)
  - The derivation path used by the Ethereum message. See [here](https://www.ledger.com/blog/understanding-crypto-addresses-and-derivation-paths) for more information.

- `typedData`

  - **Required**
  - **Type:** `TypedData`

    ```typescript
    interface TypedData {
      domain: TypedDataDomain;
      types: Record<string, Array<TypedDataField>>;
      primaryType: string;
      message: Record<string, unknown>;
    }

    interface TypedDataDomain {
      name?: string;
      version?: string;
      chainId?: number;
      verifyingContract?: string;
      salt?: string;
    }

    interface TypedDataField {
      name: string;
      type: string;
    }
    ```

  - The typed data as defined at [EIP-712](https://eips.ethereum.org/EIPS/eip-712).

**Returns**

- `observable`

  - An [Observable](https://rxjs.dev/guide/observable) object that contains the [`DeviceActionState`](https://github.com/LedgerHQ/device-sdk-ts/blob/develop/packages/core/src/api/device-action/model/DeviceActionState.ts) derived instance which reprensents the operation's state. For example:

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
    type Signature = {
      r: `0x${string}`;
      s: `0x${string}`;
      v: number;
    };
    ```

- `cancel`
  - The function without a return value to cancel the action on the Ledger device.

## Example

We encourage you to explore the Ethereum Keyring by trying it out in our online [sample application](https://app.devicesdk.ledger-test.com/). Experience how it works and see its capabilities in action. Of course, you will need a Ledger device connected.
