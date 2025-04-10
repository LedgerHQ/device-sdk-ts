# Transport Device Kit Web BLE

> [!CAUTION]
> This is still under development and we are free to make new interfaces which may lead to breaking changes.

- [Transport Device Kit Web BLE Documentation](#transport-device-kit-web-ble)
  - [Description](#description)
  - [Installation](#installation)
  - [Usage](#usage)
    - [Compatibility](#compatibility)
    - [Pre-requisites](#pre-requisites)
    - [Main Features](#main-features)
    - [How To](#how-to)

## Description

This transport is used to interact with a Ledger device through the Web BLE (Bluetooth) implementation by the Device Management Kit.

## Installation

To install the core package, run the following command:

```sh
npm install @ledgerhq/device-transport-kit-web-ble
```

## Usage

### Compatibility

This library works in [any browser supporting the Web Bluetooth API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API#browser_compatibility).

### Pre-requisites

To use this transport, ensure you have the Device Management Kit installed in your project.

### Main Features

- Exposing a transport factory to be injected into the DeviceManagementKit
- Exposing the transport directly for a custom configuration

### How To

To use the transport, you need to inject it in the DeviceManagementKitBuilder before the build. This will allow the Device Management Kit to find and interact with devices on the Web BLE protocol.

```typescript
import { DeviceManagementKitBuilder } from "@ledgerhq/device-management-kit"
import { webBleTransportFactory, WebBleTransport } from "@ledgerhq/device-transport-kit-web-ble"

// Easy setup with the factory
const dmk = new DeviceManagementKitBuilder()
  .addTransport(webBleTransportFactory)
  .build();


// With custom config
const dmk = new DeviceManagementKitBuilder()
  .addTransport(({
    deviceModelDataSource: DeviceModelDataSource;
    loggerServiceFactory: (tag: string) => LoggerPublisherService;
    config: DmkConfig;
    apduSenderServiceFactory: ApduSenderServiceFactory;
    apduReceiverServiceFactory: ApduReceiverServiceFactory;
  }) => {
    // custom code
    return new WebBleTransport(
      deviceModelDataSource,
      loggerServiceFactory,
      config,
      apduSenderServiceFactory,
      apduReceiverServiceFactory,
    );
  })
  .build();

  // You can then make use of the Device Management Kit
```
