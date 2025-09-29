import { PermissionsAndroid, Platform } from "react-native";
import { BleManager } from "react-native-ble-plx";
import type { TransportFactory } from "@ledgerhq/device-management-kit";

import { AndroidPermissionsService } from "@api/permissions/AndroidPermissionsService";
import { DefaultPermissionsService } from "@api/permissions/DefaultPermissionsService";
import { type PermissionsAndroidNarrowedType } from "@api/permissions/PermissionsAndroidNarrowedType";

import { RNBleTransport } from "./RNBleTransport";

export const RNBleTransportFactory: TransportFactory = ({
  deviceModelDataSource,
  loggerServiceFactory,
  apduSenderServiceFactory,
  apduReceiverServiceFactory,
}) =>
  new RNBleTransport(
    deviceModelDataSource,
    loggerServiceFactory,
    apduSenderServiceFactory,
    apduReceiverServiceFactory,
    new BleManager(),
    Platform,
    Platform.OS === "android"
      ? new AndroidPermissionsService(
          PermissionsAndroid as PermissionsAndroidNarrowedType,
          Platform.Version,
        )
      : new DefaultPermissionsService(),
  );
