# Transport Device Kit React Native BLE

> [!CAUTION]
> This is still under development and we are free to make new interfaces which may lead to breaking changes.

- [Transport Device Kit React Native BLE Documentation](#transport-device-kit-react-native-ble)
  - [Description](#description)
  - [Installation](#installation)
  - [Usage](#usage)
    - [Compatibility](#compatibility)
    - [Pre-requisites](#pre-requisites)
    - [Main Features](#main-features)
    - [How To](#how-to)

## Description

This transport is used to interact with a Ledger device through [react-native-ble-plx](https://github.com/dotintent/react-native-ble-plx) implementation by the Device Management Kit.

## Installation

To install the core package, run the following command:

```sh
npm install @ledgerhq/device-transport-kit-react-native-ble
```

## Usage

### Compatibility

- iOS (11+)
- Android (6.0+)

| React Native | React Native BLE PLX | 0.1.1 |
| :----------: | :------------------: | :---: |
|   \>0.74.1   |        0.3.4         |  ✅   |

### Pre-requisites

To use this transport, ensure you have the Device Management Kit installed in your project.

### Main Features

- Exposing a transport factory to be injected into the DeviceManagementKit
- Exposing the transport directly for a custom configuration

### How To

To use the transport, you need to inject it in the DeviceManagementKitBuilder before the build. This will allow the Device Management Kit to find and interact with devices on the iOS or Android BLE protocol.

```typescript
import { DeviceManagementKitBuilder } from "@ledgerhq/device-management-kit";
import {
  rnBleTransportIdentifier,
  RNBleTransport,
} from "@ledgerhq/device-transport-kit-react-native-ble";

// Easy setup with the factory
const dmk = new DeviceManagementKitBuilder()
  .addTransport(rnBleTransportIdentifier)
  .build();

// With custom config
const dmk = new DeviceManagementKitBuilder()
  .addTransport(
    ({
      deviceModelDataSource,
      loggerServiceFactory,
      config,
      apduSenderServiceFactory,
      apduReceiverServiceFactory,
    }: {
      deviceModelDataSource: DeviceModelDataSource;
      loggerServiceFactory: (tag: string) => LoggerPublisherService;
      config: DmkConfig;
      apduSenderServiceFactory: ApduSenderServiceFactory;
      apduReceiverServiceFactory: ApduReceiverServiceFactory;
    }) => {
      // custom code
      return new RNBleTransport(
        deviceModelDataSource,
        loggerServiceFactory,
        config,
        apduSenderServiceFactory,
        apduReceiverServiceFactory,
      );
    },
  )
  .build();

// You can then make use of the Device Management Kit
```
