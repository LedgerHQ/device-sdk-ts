# Ledger Internet Computer Signer Implementation

This module provides the implementation of the Ledger Internet Computer (ICP) signer of the Device Management Kit. It enables interaction with the Internet Computer application on a Ledger device including:

- Retrieving the ICP public key, account identifier and principal for a given derivation path;
- Signing an Internet Computer transaction;
- Retrieving the app configuration (version);

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

The Ledger Internet Computer Signer utilizes the advanced capabilities of the Ledger device to provide secure operations for end users. It takes advantage of the interface provided by the Device Management Kit to establish communication with the Ledger device and execute various operations. The communication with the Ledger device is performed using [APDU](https://en.wikipedia.org/wiki/Smart_card_application_protocol_data_unit)s (Application Protocol Data Units), which are encapsulated within the `Command` object. These commands are then organized into tasks, allowing for the execution of complex operations with one or more APDUs. The tasks are further encapsulated within `DeviceAction` objects to handle different real-world scenarios. Finally, the Signer exposes dedicated and independent use cases that can be directly utilized by end users.

## 🔹 Installation

> **Note:** This module is not standalone; it depends on the [@ledgerhq/device-management-kit](https://github.com/LedgerHQ/device-sdk-ts/tree/develop/packages/device-management-kit) package, so you need to install it first.

To install the `device-signer-kit-icp` package, run the following command:

```sh
npm install @ledgerhq/device-signer-kit-icp
```

## 🔹 Initialisation

To initialise an ICP signer instance, you need a Ledger Device Management Kit instance and the ID of the session of the connected device. Use the `SignerIcpBuilder`:

```typescript
const signerIcp = new SignerIcpBuilder({ dmk, sessionId }).build();
```

## 🔹 Use Cases

The `SignerIcpBuilder.build()` method will return a `SignerIcp` instance that exposes 3 dedicated methods, each of which calls an independent use case. Each use case will return an object that contains an observable and a method called `cancel`.

---

### Use Case 1: Get Address

This method allows users to retrieve the ICP public key, account identifier and principal based on a given `derivationPath`.

```typescript
const { observable, cancel } = signerIcp.getAddress(derivationPath, options);
```

#### **Parameters**

- `derivationPath`

  - **Required**
  - **Type:** `string` (e.g., `"44'/223'/0'/0/0"`)
  - The derivation path used for the ICP address. See [here](https://www.ledger.com/blog/understanding-crypto-addresses-and-derivation-paths) for more information.

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
  - `skipOpenApp`: An optional boolean indicating whether to skip opening the ICP app on the device (`true`) or not (`false`). Use when the app is already open.

#### **Returns**

- `observable` Emits DeviceActionState updates, including the following details:

```typescript
type Address = {
  publicKey: string; // hex-encoded secp256k1 public key
  accountId: string; // hex-encoded account identifier
  principal: string; // textual principal
};
```

- `cancel` A function to cancel the action on the Ledger device.

---

### Use Case 2: Sign Transaction

Securely sign an Internet Computer transaction on Ledger devices.

```typescript
const { observable, cancel } = signerIcp.signTransaction(
  derivationPath,
  transaction,
  options,
);
```

#### **Parameters**

- `derivationPath`

  - **Required**
  - **Type:** `string` (e.g., `"44'/223'/0'/0/0"`)
  - The derivation path used for the ICP address.

- `transaction`

  - **Required**
  - **Type:** `Uint8Array`
  - The serialized transaction bytes (CBOR request) to sign.

- `options`

  - Optional
  - Type: `TransactionOptions`

    ```typescript
    type TransactionOptions = {
      skipOpenApp?: boolean;
    };
    ```

  - `skipOpenApp`: An optional boolean indicating whether to skip opening the ICP app on the device (`true`) or not (`false`). Use when the app is already open.

#### **Returns**

- `observable` Emits DeviceActionState updates, including the following details:

```typescript
type Signature = {
  r: string; // hex-encoded 32-byte R value
  s: string; // hex-encoded 32-byte S value
  v: number; // recovery id
  der: string; // hex-encoded DER signature
};
```

- `cancel` A function to cancel the action on the Ledger device.

---

### Use Case 3: Get App Configuration

This method allows the user to fetch the current app configuration.

```typescript
const { observable, cancel } = signerIcp.getAppConfiguration();
```

#### **Returns**

- `observable` Emits DeviceActionState updates, including the following details:

```typescript
type Version = {
  version: string; // "major.minor.patch"
  testMode: boolean;
  locked: boolean;
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

## 🔹 Example

We encourage you to explore the Internet Computer Signer by trying it out in our online [sample application](https://app.devicesdk.ledger-test.com/). Experience how it works and see its capabilities in action. Of course, you will need a Ledger device connected.
