import React from "react";
import { createContext, PropsWithChildren, useContext } from "react";
import {
  ConsoleLogger,
  DeviceSdk,
  DeviceSdkBuilder,
} from "@ledgerhq/device-management-kit";

export const sdk = new DeviceSdkBuilder()
  .addLogger(new ConsoleLogger())
  .build();

const SdkContext = createContext<DeviceSdk>(sdk);

export const SdkProvider: React.FC<PropsWithChildren> = ({ children }) => {
  return <SdkContext.Provider value={sdk}>{children}</SdkContext.Provider>;
};

export const useSdk = (): DeviceSdk => {
  return useContext(SdkContext);
};
