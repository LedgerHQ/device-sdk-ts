# Device SDK Core Library Documentation

- [Device SDK Core Library Documentation](#device-sdk-core-library-documentation)
  - [Description](#description)
  - [Installation](#installation)
  - [Usage](#usage)
    - [Compatibility](#compatibility)
    - [Pre-requisites](#pre-requisites)
    - [Main Features](#main-features)
    - [Setting up the SDK](#setting-up-the-sdk)
    - [Connecting to a Device](#connecting-to-a-device)
    - [Sending an APDU](#sending-an-apdu)
    - [Sending a Pre-defined Command](#sending-a-pre-defined-command)
      - [Open App](#open-app)
      - [Close App](#close-app)
      - [Get OS Version](#get-os-version)
      - [Get App and Version](#get-app-and-version)
    - [Building a Custom Command](#building-a-custom-command)
    - [Example in React](#example-in-react)

## Description

The core package contains the core of the Device SDK. It provides a simple interface to handle Ledger devices and features the SDK's entry points, classes, types, structures, and models.

## Installation

To install the core package, run the following command:

```sh
npm install @ledgerhq/device-sdk-core
```

## Usage

### Compatibility

This library works in [any browser supporting the WebHID API](https://developer.mozilla.org/en-US/docs/Web/API/WebHID_API#browser_compatibility).

### Pre-requisites

Some of the APIs exposed return objects of type `Observable` from RxJS. Ensure you are familiar with the basics of the Observer pattern and RxJS before using this SDK. You can refer to [RxJS documentation](https://rxjs.dev/guide/overview) for more information.

### Main Features

- Discovering and connecting to Ledger devices via USB, through [WebHID](https://developer.mozilla.org/en-US/docs/Web/API/WebHID_API).
- Observing the state of a connected device.
- Sending custom APDU commands to Ledger devices.
- Sending a set of pre-defined commands to Ledger devices.
  - Get OS version
  - Get app and version
  - Open app
  - Close app
  - Get battery status

### Setting up the SDK

The core package exposes an SDK builder `DeviceSdkBuilder` which will be used to initialise the SDK with your configuration.

For now it allows you to add one or more custom loggers.

In the following example, we add a console logger (`.addLogger(new ConsoleLogger())`). Then we build the SDK with `.build()`.

**The returned object will be the entrypoint for all your interactions with the SDK.**

The SDK should be built only once in your application runtime so keep a reference of this object somewhere.

```ts
import {
  ConsoleLogger,
  DeviceSdk,
  DeviceSdkBuilder,
} from "@ledgerhq/device-sdk-core";

export const sdk = new DeviceSdkBuilder()
  .addLogger(new ConsoleLogger())
  .build();
```

### Connecting to a Device

There are two steps to connecting to a device:

- **Discovery**: `sdk.startDiscovering()`
  - Returns an observable which will emit a new `DiscoveredDevice` for every scanned device.
  - The `DiscoveredDevice` objects contain information about the device model.
  - Use one of these values to connect to a given discovered device.
- **Connection**: `sdk.connect({ deviceId: device.id })`
  - Returns a Promise resolving in a device session identifier `DeviceSessionId`.
  - **Keep this device session identifier to further interact with the device.**
  - Then, `sdk.getConnectedDevice({ sessionId })` returns the `ConnectedDevice`, which contains information about the device model and its name.

```ts
sdk.startDiscovering().subscribe({
  next: (device) => {
    sdk.connect({ deviceId: device.id }).then((sessionId) => {
      const connectedDevice = sdk.getConnectedDevice({ sessionId });
    });
  },
  error: (error) => {
    console.error(error);
  },
});
```

Then once a device is connected:

- **Disconnection**: `sdk.disconnect({ sessionId })`
- **Observe the device session state**: `sdk.getDeviceSessionState({ sessionId })`
  - This will return an `Observable<DeviceSessionState>` to listen to the known information about the device:
    - device status:
      - ready to process a command
      - busy
      - locked
      - disconnected
    - device name
    - information on the OS
    - battery status
    - currently opened app

### Sending an APDU

Once you have a connected device, you can send it APDU commands.

> ℹ️ It is recommended to use the [pre-defined commands](#sending-a-pre-defined-command) when possible, or [build your own command](#building-a-new-command), to avoid dealing with the APDU directly. It will make your code more reusable.

```ts
import {
  ApduBuilder,
  ApduParser,
  CommandUtils,
} from "@ledgerhq/device-sdk-core";

// ### 1. Building the APDU
// Use `ApduBuilder` to easily build the APDU and add data to its data field.

// Build the APDU to open the Bitcoin app
const openAppApduArgs = {
  cla: 0xe0,
  ins: 0xd8,
  p1: 0x00,
  p2: 0x00,
};
const apdu = new ApduBuilder(openAppApduArgs)
  .addAsciiStringToData("Bitcoin")
  .build();

// ### 2. Sending the APDU

const apduResponse = await sdk.sendApdu({ sessionId, apdu });

// ### 3. Parsing the result

const parser = new ApduParser(apduResponse);

if (!CommandUtils.isSuccessResponse(apduResponse)) {
  throw new Error(
    `Unexpected status word: ${parser.encodeToHexaString(
      apduResponse.statusCode,
    )}`,
  );
}
```

### Sending a Pre-defined Command

There are some pre-defined commands that you can send to a connected device.

The `sendCommand` method will take care of building the APDU, sending it to the device and returning the parsed response.

> ### ❗️ Error Responses
>
> Most of the commands will reject with an error if the device is locked.
> Ensure that the device is unlocked before sending commands. You can check the device session state (`sdk.getDeviceSessionState`) to know if the device is locked.
>
> Most of the commands will reject with an error if the response status word is not `0x9000` (success response from the device).

#### Open App

This command will open the app with the given name. If the device is unlocked, it will not resolve/reject until the user has confirmed or denied the app opening on the device.

```ts
import { OpenAppCommand } from "@ledgerhq/device-sdk-core";

const command = new OpenAppCommand("Bitcoin"); // Open the Bitcoin app

await sdk.sendCommand({ sessionId, command });
```

#### Close App

This command will close the currently opened app.

```ts
import { CloseAppCommand } from "@ledgerhq/device-sdk-core";

const command = new CloseAppCommand();

await sdk.sendCommand({ sessionId, command });
```

#### Get OS Version

This command will return information about the currently installed OS on the device.

> ℹ️ If you want this information you can simply get it from the device session state by observing it with `sdk.getDeviceSessionState({ sessionId })`.

```ts
import { GetOsVersionCommand } from "@ledgerhq/device-sdk-core";

const command = new GetOsVersionCommand();

const { seVersion, mcuSephVersion, mcuBootloaderVersion } =
  await sdk.sendCommand({ sessionId, command });
```

#### Get App and Version

This command will return the name and version of the currently running app on the device.

> ℹ️ If you want this information you can simply get it from the device session state by observing it with `sdk.getDeviceSessionState({ sessionId })`.

```ts
import { GetAppAndVersionCommand } from "@ledgerhq/device-sdk-core";

const command = new GetAppAndVersionCommand();

const { name, version } = await sdk.sendCommand({ sessionId, command });
```

### Building a Custom Command

You can build your own command simply by extending the `Command` class and implementing the `getApdu` and `parseResponse` methods.

Then you can use the `sendCommand` method to send it to a connected device.

This is strongly recommended over direct usage of `sendApdu`.

Check the existing commands for a variety of examples.

### Example in React

Check [the sample app](https://github.com/LedgerHQ/device-sdk-ts/tree/develop/apps/sample) for an advanced example showcasing all possible usages of the device SDK in a React app.
