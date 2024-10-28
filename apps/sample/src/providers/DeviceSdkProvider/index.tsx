import React, { useCallback, useEffect, useState } from "react";
import { createContext, PropsWithChildren, useContext } from "react";
import {
  BuiltinTransports,
  ConsoleLogger,
  DeviceSdk,
  DeviceSdkBuilder,
  MockTransportBuilder,
  WebBleTransportBuilder,
  WebHidTransportBuilder,
  WebLogsExporterLogger,
} from "@ledgerhq/device-management-kit";
import { FlipperSdkLogger } from "@ledgerhq/device-management-kit-flipper-plugin-client";

import { useHasChanged } from "@/hooks/useHasChanged";
import { useSdkConfigContext } from "@/providers/SdkConfig";

const SdkContext = createContext<DeviceSdk | null>(null);
const LogsExporterContext = createContext<WebLogsExporterLogger | null>(null);

export const SdkProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const {
    state: { transport, mockServerUrl },
  } = useSdkConfigContext();

  const buildMockSdk = useCallback(
    (url: string, logsExporter: WebLogsExporterLogger) => {
      return new DeviceSdkBuilder()
        .addTransportBuilder(
          new MockTransportBuilder().setConfig({ mockUrl: url }),
        )
        .addLogger(new ConsoleLogger())
        .addLogger(logsExporter)
        .addLogger(new FlipperSdkLogger())
        .build();
    },
    [],
  );

  const buildDefaultSdk = useCallback((logsExporter: WebLogsExporterLogger) => {
    return new DeviceSdkBuilder()
      .addTransportBuilder(new WebBleTransportBuilder())
      .addTransportBuilder(new WebHidTransportBuilder())
      .addLogger(new ConsoleLogger())
      .addLogger(logsExporter)
      .addLogger(new FlipperSdkLogger())
      .build();
  }, []);

  const mockServerEnabled = transport === BuiltinTransports.MOCK_SERVER;
  const [state, setState] = useState(() => {
    const logsExporter = new WebLogsExporterLogger();
    const sdk = mockServerEnabled
      ? buildMockSdk(mockServerUrl, logsExporter)
      : buildDefaultSdk(logsExporter);
    return { sdk, logsExporter };
  });

  const mockServerEnabledChanged = useHasChanged(mockServerEnabled);
  const mockServerUrlChanged = useHasChanged(mockServerUrl);

  if (mockServerEnabledChanged || mockServerUrlChanged) {
    setState(({ logsExporter }) => {
      return {
        sdk: mockServerEnabled
          ? buildMockSdk(mockServerUrl, logsExporter)
          : buildDefaultSdk(logsExporter),
        logsExporter,
      };
    });
  }

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
