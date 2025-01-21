import React, {useCallback, useEffect, useRef} from 'react';
import {createContext, type PropsWithChildren, useContext} from 'react';
import {
  ConsoleLogger,
  type DeviceManagementKit,
  DeviceManagementKitBuilder,
  WebLogsExporterLogger,
} from '@ledgerhq/device-management-kit';
import {RNBleTransportFactory} from '@ledgerhq/device-transport-kit-react-native-ble';
import {RNHidTransportFactory} from '@ledgerhq/device-transport-kit-react-native-hid';

const DmkContext = createContext<DeviceManagementKit | null>(null);
const LogsExporterContext = createContext<WebLogsExporterLogger | null>(null);

function buildDefaultDmk(logsExporter: WebLogsExporterLogger) {
  return new DeviceManagementKitBuilder()
    .addTransport(RNBleTransportFactory)
    .addTransport(RNHidTransportFactory)
    .addLogger(new ConsoleLogger())
    .addLogger(logsExporter)
    .build();
}
const logsExporter = new WebLogsExporterLogger();

export const DmkProvider: React.FC<PropsWithChildren> = ({children}) => {
  const dmk = useRef(buildDefaultDmk(new WebLogsExporterLogger()));

  useEffect(() => {
    const dmkRef = dmk.current;
    return () => {
      console.log('close dmk');
      dmkRef.close();
    };
  }, []);

  return (
    <DmkContext.Provider value={dmk.current}>
      <LogsExporterContext.Provider value={logsExporter}>
        {children}
      </LogsExporterContext.Provider>
    </DmkContext.Provider>
  );
};

export const useDmk = (): DeviceManagementKit => {
  const dmk = useContext(DmkContext);
  if (dmk === null) {
    throw new Error('useDmk must be used within a DmkContext.Provider');
  }
  return dmk;
};

export function useExportLogsCallback() {
  const logsExp = useContext(LogsExporterContext);
  if (logsExp === null) {
    throw new Error(
      'useExportLogsCallback must be used within LogsExporterContext.Provider',
    );
  }
  return useCallback(() => {
    logsExp.exportLogsToJSON();
  }, [logsExp]);
}
