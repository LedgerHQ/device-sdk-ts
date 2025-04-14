import React, {
  useEffect,
  useRef,
  createContext,
  type PropsWithChildren,
  useContext,
} from "react";
import {
  ConsoleLogger,
  type DeviceManagementKit,
  DeviceManagementKitBuilder,
} from "@ledgerhq/device-management-kit";
import { RNBleTransportFactory } from "@ledgerhq/device-transport-kit-react-native-ble";
import { RNHidTransportFactory } from "@ledgerhq/device-transport-kit-react-native-hid";

const DmkContext = createContext<DeviceManagementKit | null>(null);

function buildDefaultDmk() {
  return new DeviceManagementKitBuilder()
    .addTransport(RNBleTransportFactory)
    .addTransport(RNHidTransportFactory)
    .addLogger(new ConsoleLogger())
    .build();
}

export const DmkProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const dmk = useRef(buildDefaultDmk());

  useEffect(() => {
    const dmkRef = dmk.current;
    return () => {
      dmkRef.close();
    };
  }, []);

  return (
    <DmkContext.Provider value={dmk.current}>{children}</DmkContext.Provider>
  );
};

export const useDmk = (): DeviceManagementKit => {
  const dmk = useContext(DmkContext);
  if (dmk === null) {
    throw new Error("useDmk must be used within a DmkContext.Provider");
  }
  return dmk;
};
