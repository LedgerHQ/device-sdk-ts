import React, { useCallback, useEffect, useState } from "react";
import { createContext, type PropsWithChildren, useContext } from "react";
import {
  ConsoleLogger,
  type DeviceManagementKit,
  DeviceManagementKitBuilder,
  WebLogsExporterLogger,
} from "@ledgerhq/device-management-kit";
import { FlipperDmkLogger } from "@ledgerhq/device-management-kit-flipper-plugin-client";
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
  useMockServerUrl,
  useSpeculosUrl,
  useTransport,
} from "@/state/settings/hooks";

const DmkContext = createContext<DeviceManagementKit | null>(null);
const LogsExporterContext = createContext<WebLogsExporterLogger | null>(null);

function buildDefaultDmk(logsExporter: WebLogsExporterLogger) {
  return new DeviceManagementKitBuilder()
    .addTransport(webHidTransportFactory)
    .addTransport(webBleTransportFactory)
    .addLogger(new ConsoleLogger())
    .addLogger(logsExporter)
    .addLogger(new FlipperDmkLogger())
    .build();
}

//TODO add speculos URL to config
function buildSpeculosDmk(
  logsExporter: WebLogsExporterLogger,
  speculosUrl?: string,
) {
  return new DeviceManagementKitBuilder()
    .addTransport(speculosTransportFactory(speculosUrl))
    .addLogger(new ConsoleLogger())
    .addLogger(logsExporter)
    .addLogger(new FlipperDmkLogger())
    .build();
}

function buildMockDmk(url: string, logsExporter: WebLogsExporterLogger) {
  return new DeviceManagementKitBuilder()
    .addTransport(mockserverTransportFactory)
    .addLogger(new ConsoleLogger())
    .addLogger(logsExporter)
    .addLogger(new FlipperDmkLogger())
    .addConfig({ mockUrl: url })
    .build();
}

export const DmkProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const transport = useTransport();
  const mockServerUrl = useMockServerUrl();
  const speculosUrl = useSpeculosUrl();

  const mockServerEnabled = transport === mockserverIdentifier;
  const speculosEnabled = transport === speculosIdentifier;

  const [state, setState] = useState(() => {
    const logsExporter = new WebLogsExporterLogger();
    const dmk = speculosEnabled
      ? buildSpeculosDmk(logsExporter, speculosUrl)
      : mockServerEnabled
        ? buildMockDmk(mockServerUrl, logsExporter)
        : buildDefaultDmk(logsExporter);
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
      return {
        dmk: speculosEnabled
          ? buildSpeculosDmk(logsExporter, speculosUrl)
          : mockServerEnabled
            ? buildMockDmk(mockServerUrl, logsExporter)
            : buildDefaultDmk(logsExporter),
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
