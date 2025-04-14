import { Platform } from "react-native";
import type { TransportFactory } from "@ledgerhq/device-management-kit";

import { DefaultNativeModuleWrapper } from "@api/bridge/DefaultNativeModuleWrapper";
import { StubNativeModuleWrapper } from "@api/bridge/StubNativeModuleWrapper";
import { RNHidTransport } from "@api/transport/RNHidTransport";

import { NativeTransportModule } from "./bridge/NativeTransportModule";

export const RNHidTransportFactory: TransportFactory = ({
  deviceModelDataSource,
  loggerServiceFactory,
}) => {
  const isSupported = Platform.OS === "android";
  const nativeModuleWrapper =
    Platform.OS === "android"
      ? new DefaultNativeModuleWrapper({
          nativeModule: NativeTransportModule,
          deviceModelDataSource,
        })
      : new StubNativeModuleWrapper();

  return new RNHidTransport(
    isSupported,
    nativeModuleWrapper,
    loggerServiceFactory,
  );
};
