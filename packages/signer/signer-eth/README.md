# Ledger Ethereum Signer

This module provides the implementation of the Ledger Ethereum signer of the Device Management Kit. It enables interaction with the Ethereum application on a Ledger device including:

- Retrieving the Ethereum address using a given derivation path;
- Signing an Ethereum transaction ([Clear Signing](https://www.ledger.com/academy/topics/ledgersolutions/what-is-clear-signing));
- Signing a message displayed on a Ledger device;
- Signing an [EIP-712](https://eips.ethereum.org/EIPS/eip-712) specified message.

## 🔹 Index

1. [How it works](#-how-it-works)
2. [Installation](#-installation)
3. [Initialisation](#-initialisation)
4. [Use Cases](#-use-cases)
   - [Get Address](#use-case-1-get-address)
   - [Sign Transaction](#use-case-2-sign-transaction)
   - [Sign Message](#use-case-3-sign-message)
   - [Sign Typed Data](#use-case-4-sign-typed-data)
5. [Observable Behavior](#-observable-behavior)
6. [Example](#-example)

## 🔹 How it works

The Ledger Ethereum Signer utilizes the advanced capabilities of the Ledger device to provide secure operations for end users. It takes advantage of the interface provided by the Device Management Kit to establish communication with the Ledger device and execute various operations, including signing transactions. The communication with the Ledger device is performed using [APDU](https://en.wikipedia.org/wiki/Smart_card_application_protocol_data_unit)s (Application Protocol Data Units), which are encapsulated within the `Command` object. These commands are then organized into tasks, allowing for the execution of complex operations with one or more APDUs. The tasks are further encapsulated within `DeviceAction` objects to handle different real-world scenarios. Finally, the Signer exposes dedicated and independent use cases that can be directly utilized by end users.

## 🔹 Installation

> **Note:** This module is not standalone; it depends on the [@ledgerhq/device-management-kit](https://github.com/LedgerHQ/device-sdk-ts/tree/develop/packages/device-management-kit) package, so you need to install it first.

To install the `device-signer-kit-ethereum` package, run the following command:

```sh
npm install @ledgerhq/device-signer-kit-ethereum
```

## 🔹 Initialisation

To initialise an Ethereum signer instance, you need a Ledger Device Management Kit instance and the ID of the session of the connected device. Use the `SignerEthBuilder` along with the [Context Module](https://github.com/LedgerHQ/device-sdk-ts/tree/develop/packages/signer/context-module) by default developed by Ledger:

```typescript
// Initialise an Ethereum signer instance using default context module
const signerEth = new SignerEthBuilder({ sdk, sessionId }).build();
```

You can also configure the context module yourself:

```typescript
// Initialise an Ethereum signer instance using customized context module
const signerEth = new SignerEthBuilder({ sdk, sessionId })
  .withContextModule(customContextModule)
  .build();
```

## 🔹 Use Cases

The `SignerEthBuilder.build()` method will return a `SignerEth` instance that exposes 4 dedicated methods, each of which calls an independent use case. Each use case will return an object that contains an observable and a method called `cancel`.

---

### Use Case 1: Get Address

This method allows users to retrieve the Ethereum address according to given `derivationPath`.

```typescript
const { observable, cancel } = signerEth.getAddress(derivationPath, options);
```

#### **Parameters**

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

#### **Returns**

- `observable` Emits DeviceActionState updates, including the following details:

```typescript
type GetAddressCommandResponse = {
  publicKey: string; // Public key derived from the given path
  address: `0x${string}`; // Ethereum address in hex format
  chainCode?: string; // Optional chain code
};
```

- `cancel` A function to cancel the action on the Ledger device.

---

### Use Case 2: Sign Transaction

This method enables users to securely sign transactions using clear signing on Ledger devices.

```typescript
const { observable, cancel } = signerEth.signTransaction(
  derivationPath,
  transaction,
  options,
);
```

#### **Parameters**

- `derivationPath`

  - **Required**
  - **Type:** `string` (e.g., `"44'/60'/0'/0/0"`)
  - The derivation path used in the transaction. See [here](https://www.ledger.com/blog/understanding-crypto-addresses-and-derivation-paths) for more information.

- `transaction`

  - **Required**
  - **Type:**`Uint8Array`
  - The transaction buffer that needs to be signed.

- `options`

  - **Optional**
  - **Type:** `TransactionOptions`

    ```typescript
    type TransactionOptions = {
      domain?: string;
    };
    ```

  - `domain` An optional string representing the domain present in the transaction. Currently, only ENS domains are supported.

#### **Returns**

- `observable` Emits DeviceActionState updates, including the following details:

```typescript
type Signature = {
  r: `0x${string}`; // R component of the signature
  s: `0x${string}`; // S component of the signature
  v: number; // Recovery parameter
};
```

- `cancel` A function to cancel the action on the Ledger device.

---

### Use Case 3: Sign Message

This method allows users to sign a text string that is displayed on Ledger devices.

```typescript
const { observable, cancel } = signerEth.signMessage(derivationPath, message);
```

#### **Parameters**

- `derivationPath`

  - **Required**
  - **Type:** `string` (e.g., `"44'/60'/0'/0/0"`)
  - The derivation path used by the Ethereum message. See [here](https://www.ledger.com/blog/understanding-crypto-addresses-and-derivation-paths) for more information.

- `message`

  - **Required**
  - **Type:** `string`
  - The message to be signed, which will be displayed on the Ledger device.

#### **Returns**

- `observable` Emits DeviceActionState updates, including the following details:

```typescript
type Signature = {
  r: `0x${string}`; // R component of the signature
  s: `0x${string}`; // S component of the signature
  v: number; // Recovery parameter
};
```

- `cancel` A function to cancel the action on the Ledger device.

---

### Use Case 4: Sign Typed Data

This method enables users to sign an Ethereum message following the [EIP-712](https://eips.ethereum.org/EIPS/eip-712) specification.

```typescript
const { observable, cancel } = signerEth.signTypedData(
  derivationPath,
  typedData,
);
```

#### **Parameters**

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

#### **Returns**

- `observable` Emits DeviceActionState updates, including the following details:

```typescript
type Signature = {
  r: `0x${string}`; // R component of the signature
  s: `0x${string}`; // S component of the signature
  v: number; // Recovery parameter
};
```

- `cancel` A function to cancel the action on the Ledger device.

### Use Case 5: Sign Delegation Authorization (EIP-7702)

This method enables users to sign a delegation authorization message following the [EIP-7702](https://eips.ethereum.org/EIPS/eip-7702) specification.

```typescript
const { observable, cancel } = signerEth.signDelegationAuthorization(
  derivationPath,
  chainId,
  contractAddress,
  nonce,
);
```

#### **Parameters**

- `derivationPath`

  - **Required**
  - **Type:** `string` (e.g., `"44'/60'/0'/0/0"`)
  - The derivation path used by the Ethereum message. See [here](https://www.ledger.com/blog/understanding-crypto-addresses-and-derivation-paths) for more information.

- `chainId`

  - **Required**
  - **Type:** `number`
  - The chain ID of the Ethereum network.

- `contractAddress`

  - **Required**
  - **Type:** `string`
  - The address of the contract to be authorized.

- `nonce`

  - **Required**
  - **Type:** `number`
  - The nonce of the transaction.

#### **Returns**

- `observable` Emits DeviceActionState updates, including the following details:

```typescript
type Signature = {
  r: `0x${string}`; // R component of the signature
  s: `0x${string}`; // S component of the signature
  v: number; // Recovery parameter
};
```

- `cancel` A function to cancel the action on the Ledger device.

## 🔹 Observable Behavior

Each method returns an [Observable](https://rxjs.dev/guide/observable) emitting updates structured as [`DeviceActionState`](https://github.com/LedgerHQ/device-sdk-ts/blob/develop/packages/device-management-kit/src/api/device-action/model/DeviceActionState.ts). These updates reflect the operation’s progress and status:

- **NotStarted**: The operation hasn’t started.
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
        // Access the error here if occurred
        console.log("An error occurred during the action: ", error);
        break;
      }
    }
  },
});
```

**Intermediate Values in Pending Status:**

When the status is DeviceActionStatus.Pending, the state will include an `intermediateValue` object that provides useful information for interaction. The intermediateValue contains:

- `requiredUserInteraction`: Indicates what action is needed from the user
- `step`: The current step in the device action flow, available for the 'signTransaction' and 'signTypedData' flow.

```typescript
const { requiredUserInteraction, step /* if available */ } = intermediateValue;

if (step !== undefined) {
  console.log("Current step:", step);
}

switch (requiredUserInteraction) {
  case UserInteractionRequired.SignPersonalMessage: {
    // User needs to sign the message displayed on the device
    console.log("User needs to sign the message displayed on the device.");
    break;
  }
  case UserInteractionRequired.SignTypedData: {
    // User needs to sign the typed data displayed on the device
    console.log("User needs to sign the typed data displayed on the device.");
    break;
  }
  case UserInteractionRequired.SignTransaction: {
    // User needs to sign the transaction displayed on the device
    console.log("User needs to sign the transaction displayed on the device.");
    break;
  }
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
  case UserInteractionRequired.Web3ChecksOptIn: {
    // User needs to opt-in for web3 checks
    console.log("User needs to opt-in for web3 checks.");
    break;
  }
  default:
    // Type guard to ensure all cases are handled
    const uncaughtUserInteraction: never = requiredUserInteraction;
    console.error("Unhandled user interaction case:", uncaughtUserInteraction);
}
```

## 🔹 Example

We encourage you to explore the Ethereum Signer by trying it out in our online [sample application](https://app.devicesdk.ledger-test.com/). Experience how it works and see its capabilities in action. Of course, you will need a Ledger device connected.
