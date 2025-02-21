# Device Transport Kit React Native HID

> [!CAUTION]
> This is still under development and we are free to make new interfaces which may lead to breaking changes.

- [Device Transport Kit React Native HID](#device-transport-kit-react-native-hid)
  - [Description](#description)
  - [Installation](#installation)
  - [Usage](#usage)
    - [Compatibility](#compatibility)
    - [Pre-requisites](#pre-requisites)
      - [AndroidManifest.xml](#androidmanifestxml)
    - [Main Features](#main-features)
    - [How To](#how-to)

## Description

This transport is used to interact with a Ledger device through the React Native HID (usb) implementation by the Device Management Kit.

## Installation

To install the core package, run the following command:

```sh
npm install @ledgerhq/device-transport-kit-react-native-hid
```

## Usage

### Compatibility

This library works in React Native projects.

The transport itself is only compatible with Android devices but there is no additional configuration needed for other platforms, the Device Management Kit will simply not use that transport.

### Pre-requisites

To use this transport, ensure you have the Device Magement Kit installed in your project.

#### AndroidManifest.xml

Add the following to your `AndroidManifest.xml` file in your `<activity>`:

```xml
<intent-filter>
    <action android:name="android.hardware.usb.action.USB_DEVICE_ATTACHED" />
</intent-filter>
<meta-data android:name="android.hardware.usb.action.USB_DEVICE_ATTACHED" android:resource="@xml/usb_device_filter" />
```

And in your app's config in the resources folder, add a new file `app/src/main/res/xml/usb_device_filter.xml` with the following content:

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <usb-device vendor-id="11415" />
</resources>
```

This will allow your app to detect when a Ledger device is connected to the phone.

### Main Features

- Exposing a transport factory to be injected into the DeviceManagementKit
- Exposing the transport directly for a custom configuration

### How To

To use the transport, you need to inject it in the DeviceManagementKitBuilder before the build. This will allow the Device Management Kit to find and interact with USB devices.

```typescript
import { DeviceManagementKitBuilder } from "@ledgerhq/device-management-kit";
import {
  RNHidTransportFactory,
  RNHidTransport,
} from "@ledgerhq/device-transport-kit-react-native-hid";

// Easy setup with the factory
const dmk = new DeviceManagementKitBuilder()
  .addTransport(RNHidTransportFactory)
  .build();

// You can then make use of the Device Management Kit
```
