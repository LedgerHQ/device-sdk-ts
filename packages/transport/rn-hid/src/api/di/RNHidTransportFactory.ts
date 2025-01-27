import { Platform } from "react-native";
import type { TransportFactory } from "@ledgerhq/device-management-kit";

import {
  DefaultNativeModuleWrapper,
  NativeTransportModule,
} from "@api/bridge/DefaultNativeModuleWrapper";
import { StubNativeModuleWrapper } from "@api/transport/NativeModuleWrapper";
import { RNHidTransport } from "@api/transport/RNHidTransport";

export const RNHidTransportFactory: TransportFactory = ({
  deviceModelDataSource,
  loggerServiceFactory,
}) =>
  new RNHidTransport(
    Platform.OS === "android",
    deviceModelDataSource,
    loggerServiceFactory,
    Platform.OS === "android"
      ? new DefaultNativeModuleWrapper({
          nativeModule: NativeTransportModule,
          deviceModelDataSource,
        })
      : new StubNativeModuleWrapper(),
  );
