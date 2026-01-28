import React, {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useRef,
} from "react";
import {
  ConsoleLogger,
  type DeviceManagementKit,
  DeviceManagementKitBuilder,
} from "@ledgerhq/device-management-kit";
import {
  DevToolsDmkInspector,
  DevToolsLogger,
} from "@ledgerhq/device-management-kit-devtools-core";
import { RozeniteConnector } from "@ledgerhq/device-management-kit-devtools-rozenite";
import { RNBleTransportFactory } from "@ledgerhq/device-transport-kit-react-native-ble";
import { RNHidTransportFactory } from "@ledgerhq/device-transport-kit-react-native-hid";

const DmkContext = createContext<DeviceManagementKit | null>(null);

function buildDefaultDmk() {
  const connector = RozeniteConnector.getInstance();

  const dmk = new DeviceManagementKitBuilder()
    .addTransport(RNBleTransportFactory)
    .addTransport(RNHidTransportFactory)
    .addLogger(new ConsoleLogger())
    .addLogger(new DevToolsLogger(connector))
    .build();

  // Create inspector after DMK is built
  const inspector = new DevToolsDmkInspector(connector, dmk);

  return { dmk, inspector };
}

export const DmkProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const state = useRef(buildDefaultDmk());

  useEffect(() => {
    const { dmk, inspector } = state.current;
    return () => {
      inspector.destroy();
      dmk.close();
    };
  }, []);

  return (
    <DmkContext.Provider value={state.current.dmk}>
      {children}
    </DmkContext.Provider>
  );
};

export const useDmk = (): DeviceManagementKit => {
  const dmk = useContext(DmkContext);
  if (dmk === null) {
    throw new Error("useDmk must be used within a DmkContext.Provider");
  }
  return dmk;
};
