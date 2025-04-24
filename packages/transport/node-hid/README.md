# Transport Device Kit Node HID

> [!CAUTION]
> This is still under development and we are free to make new interfaces which may lead to breaking changes.

- [Transport Device Kit Node HID Documentation](#transport-device-kit-node-hid)
  - [Description](#description)
  - [Installation](#installation)
  - [Usage](#usage)
    - [Compatibility](#compatibility)
    - [Pre-requisites](#pre-requisites)
    - [Main Features](#main-features)
    - [How To](#how-to)

## Description

This transport is used to interact with a Ledger device through the Node HID (USB) implementation by the Device Management Kit.

## Installation

To install the core package, run the following command:

```sh
npm install @ledgerhq/device-transport-kit-node-hid
```

## Usage

### Compatibility

This library works in Node projects from Node v10 to Node v20 and Electron projects from Electron v3 to Electron v24.

### Pre-requisites

To use this transport, ensure you have the Device Management Kit installed in your project.

### Main Features

- Exposing a transport factory to be injected into the DeviceManagementKit
- Exposing the transport directly for a custom configuration

### How To

To use the transport, you need to inject it in the DeviceManagementKitBuilder before the build. This will allow the Devivce Management Kit to find and interact with devices with Node HID protocol.

```typescript
import { DeviceManagementKitBuilder } from "@ledgerhq/device-management-kit"
import { nodeHidTransportFactory, NodeHidTransport } from "@ledgerhq/device-transport-kit-node-hid"

// Easy setup with the factory
const dmk = new DeviceManagementKitBuilder()
  .addTransport(nodeHidTransportFactory)
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
    return new NodeHidTransport(
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
