import React, { useCallback, useEffect, useState } from "react";
import { createContext, PropsWithChildren, useContext } from "react";
import {
  BuiltinTransports,
  ConsoleLogger,
  DeviceSdk,
  DeviceSdkBuilder,
  WebLogsExporterLogger,
} from "@ledgerhq/device-management-kit";

import { useMockServerContext } from "@/providers/MockServerProvider";

const SdkContext = createContext<DeviceSdk | null>(null);
const LogsExporterContext = createContext<WebLogsExporterLogger | null>(null);

function buildDefaultSdk(logsExporter: WebLogsExporterLogger) {
  return new DeviceSdkBuilder()
    .addTransport(BuiltinTransports.USB)
    .addLogger(new ConsoleLogger())
    .addLogger(logsExporter)
    .build();
}

function buildMockSdk(url: string, logsExporter: WebLogsExporterLogger) {
  return new DeviceSdkBuilder()
    .addTransport(BuiltinTransports.MOCK_SERVER)
    .addLogger(new ConsoleLogger())
    .addLogger(logsExporter)
    .addConfig({ mockUrl: url })
    .build();
}

export const SdkProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const {
    state: { enabled: mockServerEnabled, url },
  } = useMockServerContext();
  const [state, setState] = useState(() => {
    const logsExporter = new WebLogsExporterLogger();
    const sdk = buildDefaultSdk(logsExporter);
    return { sdk, logsExporter };
  });

  useEffect(() => {
    if (mockServerEnabled) {
      setState(({ logsExporter }) => ({
        sdk: buildMockSdk(url, logsExporter),
        logsExporter,
      }));
    } else {
      setState(({ logsExporter }) => ({
        sdk: buildDefaultSdk(logsExporter),
        logsExporter,
      }));
    }
  }, [mockServerEnabled, url]);

  useEffect(() => {
    return () => {
      state.sdk.close();
    };
  }, [state.sdk]);

  return (
    <SdkContext.Provider value={state.sdk}>
      <LogsExporterContext.Provider value={state.logsExporter}>
        {children}
      </LogsExporterContext.Provider>
    </SdkContext.Provider>
  );
};

export const useSdk = (): DeviceSdk => {
  const sdk = useContext(SdkContext);
  if (sdk === null)
    throw new Error("useSdk must be used within a SdkContext.Provider");
  return sdk;
};

export function useExportLogsCallback() {
  const logsExporter = useContext(LogsExporterContext);
  if (logsExporter === null) {
    throw new Error(
      "useExportLogsCallback must be used within LogsExporterContext.Provider",
    );
  }
  return useCallback(() => {
    logsExporter.exportLogsToJSON();
  }, [logsExporter]);
}
