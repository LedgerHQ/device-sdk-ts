import React, { useCallback } from "react";
import { createContext, PropsWithChildren, useContext } from "react";
import {
  BuiltinTransports,
  ConsoleLogger,
  DeviceSdk,
  DeviceSdkBuilder,
  WebLogsExporterLogger,
} from "@ledgerhq/device-management-kit";

const webLogsExporterLogger = new WebLogsExporterLogger();

export const sdk = new DeviceSdkBuilder()
  .addLogger(new ConsoleLogger())
  .addLogger(webLogsExporterLogger)
  .addTransport(BuiltinTransports.USB)
  .build();

const SdkContext = createContext<DeviceSdk>(sdk);

export const SdkProvider: React.FC<PropsWithChildren> = ({ children }) => {
  return <SdkContext.Provider value={sdk}>{children}</SdkContext.Provider>;
};

export const useSdk = (): DeviceSdk => {
  return useContext(SdkContext);
};

export function useExportLogsCallback() {
  return useCallback(() => {
    webLogsExporterLogger.exportLogsToJSON();
  }, []);
}
