# Transport Device Kit React Native BLE

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
  RNBleTransportFactory,
  RNBleTransport,
} from "@ledgerhq/device-transport-kit-react-native-ble";

// Easy setup with the factory
const dmk = new DeviceManagementKitBuilder()
  .addTransport(RNBleTransportFactory)
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

### Android Permissions

The following table outlines the Bluetooth-related permissions needed for different Android API levels:

| Permissions                                    | Android ≤ 9 (API 28) | Android 10, 11 (API 29, 30) | Android 12+ (API 31+)     |
| ---------------------------------------------- | -------------------- | --------------------------- | ------------------------- |
| `android.permission.BLUETOOTH`                 | ✅ Needed            | ✅ Needed                   | ❌ Not Needed             |
| `android.permission.BLUETOOTH_ADMIN`           | ✅ Needed            | ✅ Needed                   | ❌ Not Needed             |
| `android.permission.ACCESS_COARSE_LOCATION` \* | ✅ Needed            | ❌ Not Needed               | ❌ Not Needed             |
| `android.permission.ACCESS_FINE_LOCATION` \*   | ❌ Not Needed        | ✅ Needed                   | ❓ Not necessarily needed |
| `android.permission.BLUETOOTH_CONNECT` \*      | ❌ Not Needed        | ❌ Not Needed               | ✅ Needed                 |
| `android.permission.BLUETOOTH_SCAN` \*         | ❌ Not Needed        | ❌ Not Needed               | ✅ Needed                 |

\*Dangerous/Runtime permissions requiring explicit user consent

**Note for Android 12+**: `ACCESS_FINE_LOCATION` is not necessarily needed if `BLUETOOTH_SCAN` is defined with `android:usesPermissionFlags="neverForLocation"` and you can strongly assert that your app never derives physical location from Bluetooth scan results.

#### Resulting Android Manifest

Add the following permissions to your `android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.BLUETOOTH" android:maxSdkVersion="30" />
<uses-permission android:name="android.permission.BLUETOOTH_ADMIN" android:maxSdkVersion="30" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" tools:node="replace" android:maxSdkVersion="28"/>
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" tools:node="replace" android:maxSdkVersion="30"/>

<!-- Bluetooth permissions: Android API >= 31 (Android 12)-->
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT"/>
<uses-permission android:name="android.permission.BLUETOOTH_SCAN" android:usesPermissionFlags="neverForLocation"/>
```
