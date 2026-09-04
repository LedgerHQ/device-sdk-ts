# Transport Device Kit Speculos

- [Transport Device Kit Speculos Documentation](#transport-device-kit-speculos)
  - [Description](#description)
  - [Installation](#installation)
  - [Usage](#usage)
    - [Compatibility](#compatibility)
    - [Pre-requisites](#pre-requisites)
    - [Main Features](#main-features)
    - [How To](#how-to)

## Description

This transport is used to communicate with the speculos device simulator developped by Ledger through http.

## Installation

To install the core package, run the following command:

```sh
npm install @ledgerhq/device-transport-kit-speculos
```

## Usage

### Compatibility

- Node.js >= 20
- Internet browsers (should work on any modern brower)

### Pre-requisites

To use this transport, ensure you have the Device Management Kit installed in your project.

### Main Features

- Exposing a transport factory to be injected into the DeviceManagementKit
- Exposing the transport directly for a custom configuration

### How To

To use the transport, you need to inject it in the DeviceManagementKitBuilder before the build. This will allow the Device Management Kit to find and interact with speculos devices trhough http

```typescript
import { DeviceManagementKitBuilder } from "@ledgerhq/device-management-kit";
import {
  speculosTransportFactory,
  SpeculosTransport,
} from "@ledgerhq/device-transport-kit-speculos";

// Easy setup with the factory
const dmk = new DeviceManagementKitBuilder()
  .addTransport(speculosTransportFactory()) // Defaults to the default speculos port http://localhost:5000
  .addTransport(speculosTransportFactory("http://localhost:5001")) // With custom server
  .build();

// With custom config
const dmk = new DeviceManagementKitBuilder()
  .addTransport(
    ({
      loggerServiceFactory,
      config,
    }: {
      loggerServiceFactory: (tag: string) => LoggerPublisherService;
      config: DmkConfig;
    }) => {
      // custom code
      const speculosUrl = "http://localhost:3333";

      return new SpeculosTransport(loggerServiceFactory, config, speculosUrl);
    },
  )
  .build();

// You can then make use of the Device Management Kit
```
