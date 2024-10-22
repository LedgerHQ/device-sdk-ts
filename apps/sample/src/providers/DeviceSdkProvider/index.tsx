import React, { useCallback, useEffect, useState } from "react";
import { createContext, PropsWithChildren, useContext } from "react";
import {
  BuiltinTransports,
  ConsoleLogger,
  DeviceSdk,
  DeviceSdkBuilder,
  WebLogsExporterLogger,
} from "@ledgerhq/device-management-kit";
import { FlipperSdkLogger } from "@ledgerhq/device-management-kit-flipper-plugin-client";

import { usePrevious } from "@/hooks/usePrevious";
import { useSdkConfigContext } from "@/providers/SdkConfig";

const webLogsExporterLogger = new WebLogsExporterLogger();

const defaultSdk = new DeviceSdkBuilder()
  .addLogger(new ConsoleLogger())
  .addTransport(BuiltinTransports.BLE)
  .addTransport(BuiltinTransports.USB)
  .addLogger(webLogsExporterLogger)
  .addLogger(new FlipperSdkLogger())
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
          .addLogger(webLogsExporterLogger)
          .addLogger(new FlipperSdkLogger())
          .build(),
      );
    } else if (previousTransport === BuiltinTransports.MOCK_SERVER) {
      sdk.close();
      setSdk(
        new DeviceSdkBuilder()
          .addLogger(new ConsoleLogger())
          .addTransport(BuiltinTransports.BLE)
          .addTransport(BuiltinTransports.USB)
          .addLogger(webLogsExporterLogger)
          .addLogger(new FlipperSdkLogger())
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
