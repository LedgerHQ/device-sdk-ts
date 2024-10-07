import { createContext, useContext } from "react";
import {
  ConsoleLogger,
  DeviceSdk,
  DeviceSdkBuilder,
} from "@ledgerhq/device-management-kit";
import { initialiseFlipperPlugin } from "@ledgerhq/device-management-kit-flipper-plugin-client";

export const sdk = new DeviceSdkBuilder()
  .addLogger(new ConsoleLogger())
  .setupFlipperPlugin(initialiseFlipperPlugin())
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
