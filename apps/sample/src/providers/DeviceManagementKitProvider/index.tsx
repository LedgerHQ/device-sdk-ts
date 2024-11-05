import React, { useCallback, useEffect, useState } from "react";
import { createContext, type PropsWithChildren, useContext } from "react";
import {
  BuiltinTransports,
  ConsoleLogger,
  type DeviceManagementKit,
  DeviceManagementKitBuilder,
  WebLogsExporterLogger,
} from "@ledgerhq/device-management-kit";
import { FlipperDmkLogger } from "@ledgerhq/device-management-kit-flipper-plugin-client";
import { WebBleTransport } from "@ledgerhq/device-transport-kit-web-ble";
import { WebHidTransport } from "@ledgerhq/device-transport-kit-web-hid";

import { useHasChanged } from "@/hooks/useHasChanged";
import { useDmkConfigContext } from "@/providers/DmkConfig";

const DmkContext = createContext<DeviceManagementKit | null>(null);
const LogsExporterContext = createContext<WebLogsExporterLogger | null>(null);

function buildDefaultDmk(logsExporter: WebLogsExporterLogger) {
  return new DeviceManagementKitBuilder()
    .addTransport(
      ({
        deviceModelDataSource,
        loggerServiceFactory,
        apduSenderServiceFactory,
        apduReceiverServiceFactory,
      }) =>
        new WebHidTransport(
          deviceModelDataSource,
          loggerServiceFactory,
          apduSenderServiceFactory,
          apduReceiverServiceFactory,
        ),
    )
    .addTransport(
      ({
        deviceModelDataSource,
        loggerServiceFactory,
        apduSenderServiceFactory,
        apduReceiverServiceFactory,
      }) =>
        new WebBleTransport(
          deviceModelDataSource,
          loggerServiceFactory,
          apduSenderServiceFactory,
          apduReceiverServiceFactory,
        ),
    )
    .addLogger(new ConsoleLogger())
    .addLogger(logsExporter)
    .addLogger(new FlipperDmkLogger())
    .build();
}

// function buildMockDmk(url: string, logsExporter: WebLogsExporterLogger) {
//   return new DeviceManagementKitBuilder()
//     .addTransport(BuiltinTransports.MOCK_SERVER)
//     .addLogger(new ConsoleLogger())
//     .addLogger(logsExporter)
//     .addLogger(new FlipperDmkLogger())
//     .addConfig({ mockUrl: url })
//     .build();
// }

export const DmkProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const {
    state: { transport, mockServerUrl },
  } = useDmkConfigContext();

  const mockServerEnabled = transport === BuiltinTransports.MOCK_SERVER;
  const [state, setState] = useState(() => {
    const logsExporter = new WebLogsExporterLogger();
    // const dmk = mockServerEnabled
    //   ? buildMockDmk(mockServerUrl, logsExporter)
    //   : buildDefaultDmk(logsExporter);
    const dmk = buildDefaultDmk(logsExporter);
    return { dmk, logsExporter };
  });

  const mockServerEnabledChanged = useHasChanged(mockServerEnabled);
  const mockServerUrlChanged = useHasChanged(mockServerUrl);

  if (mockServerEnabledChanged || mockServerUrlChanged) {
    setState(({ logsExporter }) => {
      return {
        dmk: buildDefaultDmk(logsExporter),
        // dmk: mockServerEnabled
        //   ? buildMockDmk(mockServerUrl, logsExporter)
        //   : buildDefaultDmk(logsExporter),
        logsExporter,
      };
    });
  }

  useEffect(() => {
    return () => {
      state.dmk.close();
    };
  }, [state.dmk]);

  return (
    <DmkContext.Provider value={state.dmk}>
      <LogsExporterContext.Provider value={state.logsExporter}>
        {children}
      </LogsExporterContext.Provider>
    </DmkContext.Provider>
  );
};

export const useDmk = (): DeviceManagementKit => {
  const dmk = useContext(DmkContext);
  if (dmk === null)
    throw new Error("useDmk must be used within a DmkContext.Provider");
  return dmk;
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
