import React, { useCallback, useEffect, useState } from "react";
import { createContext, PropsWithChildren, useContext } from "react";
import {
  BuiltinTransport,
  ConsoleLogger,
  DeviceSdk,
  DeviceSdkBuilder,
  WebLogsExporterLogger,
} from "@ledgerhq/device-management-kit";
import { useMockServerContext } from "@/providers/MockServerProvider";

const webLogsExporterLogger = new WebLogsExporterLogger();

const defaultSdk = new DeviceSdkBuilder()
  .addLogger(new ConsoleLogger())
  .addTransport(BuiltinTransport.USB)
  .addLogger(webLogsExporterLogger)
  .build();

const SdkContext = createContext<DeviceSdk>(defaultSdk);

export const SdkProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const {
    state: { enabled: mockServerEnabled },
  } = useMockServerContext();
  const [sdk, setSdk] = useState<DeviceSdk>(defaultSdk);
  useEffect(() => {
    if (mockServerEnabled) {
      setSdk(
        new DeviceSdkBuilder()
          .addLogger(new ConsoleLogger())
          .addTransport(BuiltinTransport.MOCK_SERVER)
          .build(),
      );
    } else {
      setSdk(defaultSdk);
    }
  }, [mockServerEnabled]);

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
