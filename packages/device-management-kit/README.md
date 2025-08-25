# Device Management Kit Library Documentation

> [!CAUTION]
> This is still under development and we are free to make new interfaces which may lead to Device Management Kit breaking changes.

- [Device Management Kit Library Documentation](#device-management-kit-library-documentation)
  - [Description](#description)
  - [Installation](#installation)
  - [Usage](#usage)
    - [Prerequisites](#prerequisites)
    - [Main Features](#main-features)
    - [Setting up the Device Management Kit](#setting-up-the-device-management-kit)
    - [Connecting to a Device](#connecting-to-a-device)
    - [Sending an APDU](#sending-an-apdu)
    - [Sending a Pre-defined Command](#sending-a-pre-defined-command)
      - [Open App](#open-app)
      - [Close App](#close-app)
      - [Get OS Version](#get-os-version)
      - [Get App and Version](#get-app-and-version)
    - [Building a Custom Command](#building-a-custom-command)
    - [Executing a device action](#executing-a-device-action)
      - [Open App Device Action](#open-app-device-action)
    - [Example in React](#example-in-react)

## Description

This package contains the core of the Device Management Kit. It provides a simple interface to handle Ledger devices and features the Device Management Kit's entry points, classes, types, structures, and models.

## Installation

To install the core package, run the following command:

```sh
npm install @ledgerhq/device-management-kit
```

## Usage

### Prerequisites

Some of the APIs exposed return objects of type `Observable` from RxJS. Ensure you are familiar with the basics of the Observer pattern and RxJS before using this Device Management Kit. You can refer to [RxJS documentation](https://rxjs.dev/guide/overview) for more information.

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

> [!NOTE]  
> At the moment we do not provide the possibility to distinguish two devices of the same model, via USB and to avoid connection to the same device twice.

### Setting up the Device Management Kit

The core package exposes a Device Manageent Kit builder `DeviceManagementKitBuilder` which will be used to initialise the Device Management Kit with your configuration.

For now it allows you to add one or more custom loggers.

In the following example, we add a console logger (`.addLogger(new ConsoleLogger())`) and a WebHID transport. Then we build the Device Management Kit with `.build()`.

**The returned object will be the entrypoint for all your interactions with the Device Management Kit.**

The Device Management Kit should be built only once in your application runtime so keep a reference of this object somewhere.

```ts
import {
  ConsoleLogger,
  DeviceManagementKitBuilder,
} from "@ledgerhq/device-management-kit";
import { webHidTransportFactory } from "@ledgerhq/device-transport-kit-web-hid";

export const sdk = new DeviceManagementKitBuilder()
  .addLogger(new ConsoleLogger())
  .addTransport(webHidTransportFactory)
  .build();
```

### Add a custom Manager API Provider

Custom providers can be set in two ways:

- At build time:

```ts
import {
  ConsoleLogger,
  DeviceManagementKitBuilder,
} from "@ledgerhq/device-management-kit";
import { webHidTransportFactory } from "@ledgerhq/device-transport-kit-web-hid";

export const sdk = new DeviceManagementKitBuilder()
  .addLogger(new ConsoleLogger())
  .addTransport(webHidTransportFactory)
  .addConfig({ provider: 123 }) // using provider key in the addConfig obj
  .build();
```

- At runtime:

```ts
dmk.setProvider(123); // using the setProvider from DMK
```

### Get the current provider

getProvider function will return the current provider set within the Device Management Kit, whether it has been set at build or run time:

```ts
dmk.getProvider();
```

### Connecting to a Device

There are two steps to connecting to a device:

- **Discovery**: `dmk.startDiscovering()`
  - Returns an observable which will emit a new `DiscoveredDevice` for every scanned device.
  - The `DiscoveredDevice` objects contain information about the device model.
  - Use one of these values to connect to a given discovered device.
- **Connection**:

```ts
dmk.connect({
  deviceId: device.id,
  {
    isRefresherDisabled: boolean;
    pollingInterval?: number;
  }
  })
```

- Returns a Promise resolving in a device session identifier `DeviceSessionId`.
- **Keep this device session identifier to further interact with the device.**
- Then, `dmk.getConnectedDevice({ sessionId })` returns the `ConnectedDevice`, which contains information about the device model and its name.

```ts
dmk.startDiscovering().subscribe({
  next: (device) => {
    dmk
    .connect({
      deviceId: device.id,
      { isRefresherDisabled: true }
    })
    .then((sessionId) => {
      const connectedDevice = dmk.getConnectedDevice({ sessionId });
    });
  },
  error: (error) => {
    console.error(error);
  },
});
```

Then once a device is connected:

- **Disconnection**: `dmk.disconnect({ sessionId })`
- **Observe the device session state**: `dmk.getDeviceSessionState({ sessionId })`
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
} from "@ledgerhq/device-management-kit";

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

const apduResponse = await dmk.sendApdu({ sessionId, apdu });

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
> Ensure that the device is unlocked before sending commands. You can check the device session state (`dmk.getDeviceSessionState`) to know if the device is locked.
>
> Most of the commands will reject with an error if the response status word is not `0x9000` (success response from the device).

#### Open App

This command will open the app with the given name. If the device is unlocked, it will not resolve/reject until the user has confirmed or denied the app opening on the device.

```ts
import { OpenAppCommand } from "@ledgerhq/device-management-kit";

const command = new OpenAppCommand("Bitcoin"); // Open the Bitcoin app

await dmk.sendCommand({ sessionId, command });

// Or with a timeout
await dmk.sendCommand({ sessionId, command, abortTimeout: 2000 });
```

#### Close App

This command will close the currently opened app.

```ts
import { CloseAppCommand } from "@ledgerhq/device-management-kit";

const command = new CloseAppCommand();

await dmk.sendCommand({ sessionId, command });
```

#### Get OS Version

This command will return information about the currently installed OS on the device.

> ℹ️ If you want this information you can simply get it from the device session state by observing it with `dmk.getDeviceSessionState({ sessionId })`.

```ts
import { GetOsVersionCommand } from "@ledgerhq/device-management-kit";

const command = new GetOsVersionCommand();

const { seVersion, mcuSephVersion, mcuBootloaderVersion } =
  await dmk.sendCommand({ sessionId, command });
```

#### Get App and Version

This command will return the name and version of the currently running app on the device.

> ℹ️ If you want this information you can simply get it from the device session state by observing it with `dmk.getDeviceSessionState({ sessionId })`.

```ts
import { GetAppAndVersionCommand } from "@ledgerhq/device-management-kit";

const command = new GetAppAndVersionCommand();

const { name, version } = await dmk.sendCommand({ sessionId, command });
```

### Building a Custom Command

You can build your own command simply by extending the `Command` class and implementing the `getApdu` and `parseResponse` methods.

Then you can use the `sendCommand` method to send it to a connected device.

This is strongly recommended over direct usage of `sendApdu`.

Check the existing commands for a variety of examples.

### Executing a device action

Device actions define a succession of commands to be sent to the device.

They are useful for actions that require user interaction, like opening an app,
or approving a transaction.

The result of a device action execution is an observable that will emit different states of the action execution. These states contain information about the current status of the action, some intermediate values like the user action required, and the final result.

#### Open App Device Action

```ts
import {
  OpenAppDeviceAction,
  OpenAppDAState,
} from "@ledgerhq/device-management-kit";

const openAppDeviceAction = new OpenAppDeviceAction({ appName: "Bitcoin" });

const { observable, cancel } = await dmk.executeDeviceAction({
  deviceAction: openAppDeviceAction,
  command,
});

observable.subscribe({
  next: (state: OpenAppDAState) => {
    switch (state.status) {
      case DeviceActionStatus.NotStarted:
        console.log("Action not started yet");
        break;
      case DeviceActionStatus.Pending:
        const {
          intermediateValue: { userActionRequired },
        } = state;
        switch (userActionRequired) {
          case UserActionRequiredType.None:
            console.log("No user action required");
            break;
          case UserActionRequiredType.ConfirmOpenApp:
            console.log(
              "The user should confirm the app opening on the device",
            );
            break;
          case UserActionRequiredType.UnlockDevice:
            console.log("The user should unlock the device");
            break;
          default:
            /**
             * you should make sure that you handle all the possible user action
             * required types by displaying them to the user.
             */
            throw new Exception("Unhandled user action required");
            break;
        }
        console.log("Action is pending");
        break;
      case DeviceActionStatus.Stopped:
        console.log("Action has been stopped");
        break;
      case DeviceActionStatus.Completed:
        const { output } = state;
        console.log("Action has been completed", output);
        break;
      case DeviceActionStatus.Error:
        const { error } = state;
        console.log("An error occurred during the action", error);
        break;
    }
  },
});
```

### Example in React

Check [the sample app](https://github.com/LedgerHQ/device-sdk-ts/tree/develop/apps/sample) for an advanced example showcasing all possible usages of the Device Management Kit in a React app.
