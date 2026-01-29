import React, { useCallback, useEffect, useRef, useState } from "react";
import { createContext, type PropsWithChildren, useContext } from "react";
import { useSelector } from "react-redux";
import {
  ConsoleLogger,
  type DeviceManagementKit,
  DeviceManagementKitBuilder,
  WebLogsExporterLogger,
} from "@ledgerhq/device-management-kit";
import {
  type Connector,
  DevToolsDmkInspector,
  DevToolsLogger,
} from "@ledgerhq/device-management-kit-devtools-core";
import { DEFAULT_CLIENT_WS_URL } from "@ledgerhq/device-management-kit-devtools-websocket-common";
import { DevToolsWebSocketConnector } from "@ledgerhq/device-management-kit-devtools-websocket-connector";
import {
  mockserverIdentifier,
  mockserverTransportFactory,
} from "@ledgerhq/device-transport-kit-mockserver";
import {
  speculosIdentifier,
  speculosTransportFactory,
} from "@ledgerhq/device-transport-kit-speculos";
import { webBleTransportFactory } from "@ledgerhq/device-transport-kit-web-ble";
import { webHidTransportFactory } from "@ledgerhq/device-transport-kit-web-hid";

import { useHasChanged } from "@/hooks/useHasChanged";
import {
  selectAppProvider,
  selectMockServerUrl,
  selectSpeculosUrl,
  selectTransport,
} from "@/state/settings/selectors";

const DmkContext = createContext<DeviceManagementKit | null>(null);
const LogsExporterContext = createContext<WebLogsExporterLogger | null>(null);

function getDevToolsConnector(): Connector {
  return DevToolsWebSocketConnector.getInstance().connect({
    url: DEFAULT_CLIENT_WS_URL,
  });
}

function buildDefaultDmk(
  logsExporter: WebLogsExporterLogger,
  devToolsLogger: DevToolsLogger,
) {
  return new DeviceManagementKitBuilder()
    .addTransport(webHidTransportFactory)
    .addTransport(webBleTransportFactory)
    .addLogger(new ConsoleLogger())
    .addLogger(logsExporter)
    .addLogger(devToolsLogger)

    .build();
}

//TODO add speculos URL to config
function buildSpeculosDmk(
  logsExporter: WebLogsExporterLogger,
  devToolsLogger: DevToolsLogger,
  speculosUrl?: string,
) {
  return new DeviceManagementKitBuilder()
    .addTransport(speculosTransportFactory(speculosUrl))
    .addLogger(new ConsoleLogger())
    .addLogger(logsExporter)
    .addLogger(devToolsLogger)
    .build();
}

function buildMockDmk(
  url: string,
  logsExporter: WebLogsExporterLogger,
  devToolsLogger: DevToolsLogger,
) {
  return new DeviceManagementKitBuilder()
    .addTransport(mockserverTransportFactory)
    .addLogger(new ConsoleLogger())
    .addLogger(logsExporter)
    .addLogger(devToolsLogger)
    .addConfig({ mockUrl: url })
    .build();
}

export const DmkProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const transport = useSelector(selectTransport);
  const mockServerUrl = useSelector(selectMockServerUrl);
  const speculosUrl = useSelector(selectSpeculosUrl);
  const appProvider = useSelector(selectAppProvider);

  const mockServerEnabled = transport === mockserverIdentifier;
  const speculosEnabled = transport === speculosIdentifier;

  // Keep connector and logger refs stable across renders
  const devToolsConnector = useRef<Connector | null>(null);
  const devToolsLogger = useRef<DevToolsLogger | null>(null);

  if (devToolsConnector.current === null) {
    devToolsConnector.current = getDevToolsConnector();
  }
  if (devToolsLogger.current === null) {
    devToolsLogger.current = new DevToolsLogger(devToolsConnector.current);
  }

  const [state, setState] = useState(() => {
    const logsExporter = new WebLogsExporterLogger();
    const dmk = speculosEnabled
      ? buildSpeculosDmk(logsExporter, devToolsLogger.current!, speculosUrl)
      : mockServerEnabled
        ? buildMockDmk(mockServerUrl, logsExporter, devToolsLogger.current!)
        : buildDefaultDmk(logsExporter, devToolsLogger.current!);

    return { dmk, logsExporter };
  });

  const mockServerEnabledChanged = useHasChanged(mockServerEnabled);
  const mockServerUrlChanged = useHasChanged(mockServerUrl);
  const speculosEnabledChanged = useHasChanged(speculosEnabled);

  if (
    mockServerEnabledChanged ||
    mockServerUrlChanged ||
    speculosEnabledChanged
  ) {
    setState(({ logsExporter }) => {
      const dmk = speculosEnabled
        ? buildSpeculosDmk(logsExporter, devToolsLogger.current!, speculosUrl)
        : mockServerEnabled
          ? buildMockDmk(mockServerUrl, logsExporter, devToolsLogger.current!)
          : buildDefaultDmk(logsExporter, devToolsLogger.current!);

      return { dmk, logsExporter };
    });
  }

  // Create inspector in useEffect to ensure proper lifecycle handling
  useEffect(() => {
    const inspector = new DevToolsDmkInspector(
      devToolsConnector.current!,
      state.dmk,
    );
    return () => inspector.destroy();
  }, [state.dmk]);

  // Sync appProvider to DMK when it changes
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    state.dmk.setProvider(appProvider);
  }, [appProvider, state.dmk]);

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
