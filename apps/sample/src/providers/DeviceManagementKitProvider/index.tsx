import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { createContext, type PropsWithChildren, useContext } from "react";
import { useSelector } from "react-redux";
import {
  ConsoleLogger,
  type DeviceManagementKit,
  DeviceManagementKitBuilder,
  WebLogsExporterLogger,
} from "@ledgerhq/device-management-kit";
import {
  DevToolsDmkInspector,
  DevToolsLogger,
} from "@ledgerhq/device-management-kit-devtools-core";
import { DEFAULT_CLIENT_WS_URL } from "@ledgerhq/device-management-kit-devtools-websocket-common";
import { DevToolsWebSocketConnector } from "@ledgerhq/device-management-kit-devtools-websocket-connector";

import { type TransportConfig } from "@/state/settings/schema";
import {
  selectAppProvider,
  selectTransportConfig,
} from "@/state/settings/selectors";

import { getTransportFactoriesForConfig } from "./transportConfig";

const DmkContext = createContext<DeviceManagementKit | null>(null);
const LogsExporterContext = createContext<WebLogsExporterLogger | null>(null);

// Module-level singletons (created once at module load)
const devToolsConnector = DevToolsWebSocketConnector.getInstance().connect({
  url: DEFAULT_CLIENT_WS_URL,
});
const devToolsLogger = new DevToolsLogger(devToolsConnector);
const logsExporter = new WebLogsExporterLogger();

function buildDmk(transportConfig: TransportConfig) {
  const { factories, config } = getTransportFactoriesForConfig(transportConfig);

  const builder = new DeviceManagementKitBuilder()
    .addLogger(new ConsoleLogger())
    .addLogger(logsExporter)
    .addLogger(devToolsLogger);

  for (const factory of factories) {
    builder.addTransport(factory);
  }

  if (config) {
    builder.addConfig(config);
  }

  return builder.build();
}

export const DmkProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const transportConfig = useSelector(selectTransportConfig);
  const appProvider = useSelector(selectAppProvider);

  const dmk = useMemo(() => buildDmk(transportConfig), [transportConfig]);

  // Create inspector in useEffect to ensure proper lifecycle handling
  useEffect(() => {
    const inspector = new DevToolsDmkInspector(devToolsConnector, dmk);
    return () => inspector.destroy();
  }, [dmk]);

  // Sync appProvider to DMK when it changes
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    dmk.setProvider(appProvider);
  }, [appProvider, dmk]);

  // Cleanup on DMK change
  useEffect(() => {
    return () => dmk.close();
  }, [dmk]);

  return (
    <DmkContext.Provider value={dmk}>
      <LogsExporterContext.Provider value={logsExporter}>
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
  const contextLogsExporter = useContext(LogsExporterContext);
  if (contextLogsExporter === null) {
    throw new Error(
      "useExportLogsCallback must be used within LogsExporterContext.Provider",
    );
  }
  return useCallback(() => {
    contextLogsExporter.exportLogsToJSON();
  }, [contextLogsExporter]);
}
