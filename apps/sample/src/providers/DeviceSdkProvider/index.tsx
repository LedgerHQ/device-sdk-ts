import { createContext, useContext } from "react";
import {
  ConsoleLogger,
  DeviceSdk,
  DeviceSdkBuilder,
  LogLevel,
} from "@ledgerhq/device-sdk-core";

export const sdk = new DeviceSdkBuilder()
  .addLogger(new ConsoleLogger(LogLevel.Info))
  .build();

const SdkContext = createContext<DeviceSdk>(sdk);

type Props = {
  children: React.ReactNode;
};

export const SdkProvider: React.FC<Props> = ({ children }) => {
  return <SdkContext.Provider value={sdk}>{children}</SdkContext.Provider>;
};

export const useSdk = (): DeviceSdk => {
  return useContext(SdkContext);
};
