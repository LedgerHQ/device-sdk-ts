import React, { useCallback, useEffect, useState } from "react";
import { createContext, PropsWithChildren, useContext } from "react";
import {
  BuiltinTransports,
  ConsoleLogger,
  DeviceSdk,
  DeviceSdkBuilder,
  WebLogsExporterLogger,
} from "@ledgerhq/device-management-kit";
import { useSdkConfigContext } from "../SdkConfig";
import { usePrevious } from "@/hooks/usePrevious";

const webLogsExporterLogger = new WebLogsExporterLogger();

const defaultSdk = new DeviceSdkBuilder()
  .addLogger(new ConsoleLogger())
  .addTransport(BuiltinTransports.BLE)
  .addTransport(BuiltinTransports.USB)
  .addLogger(webLogsExporterLogger)
  .build();

const SdkContext = createContext<DeviceSdk>(defaultSdk);

export const SdkProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const {
    state: { transport, mockServerUrl },
  } = useSdkConfigContext();
  const previousTransport = usePrevious(transport);
  const [sdk, setSdk] = useState<DeviceSdk>(defaultSdk);
  useEffect(() => {
    if (transport === BuiltinTransports.MOCK_SERVER) {
      sdk.close();
      setSdk(
        new DeviceSdkBuilder()
          .addLogger(new ConsoleLogger())
          .addTransport(BuiltinTransports.MOCK_SERVER)
          .addConfig({ mockUrl: mockServerUrl })
          .build(),
      );
    } else if (previousTransport === BuiltinTransports.MOCK_SERVER) {
      sdk.close();
      setSdk(
        new DeviceSdkBuilder()
          .addLogger(new ConsoleLogger())
          .addTransport(BuiltinTransports.BLE)
          .addTransport(BuiltinTransports.USB)
          .build(),
      );
    }
  }, [transport, mockServerUrl, previousTransport]);

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
