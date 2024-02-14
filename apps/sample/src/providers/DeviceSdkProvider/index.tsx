import { createContext, useContext } from "react";
import {
  ConsoleLogger,
  DeviceSdk,
  DeviceSdkBuilder,
} from "@ledgerhq/device-sdk-core";

export const sdk = new DeviceSdkBuilder()
  .addLogger(new ConsoleLogger())
  .build();

const SdkContext = createContext<DeviceSdk>(sdk);

type Props = {
  children: React.ReactNode;
};

export const SdkProvider: React.FC<Props> = ({ children }) => {
  return <SdkContext.Provider value={sdk}>{children}</SdkContext.Provider>;
};

export const useSdk = () => {
  return useContext(SdkContext);
};
