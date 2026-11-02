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
import { mockserverTransportFactory } from "@ledgerhq/device-transport-kit-mockserver";
import { RNBleTransportFactory } from "@ledgerhq/device-transport-kit-react-native-ble";
import { RNHidTransportFactory } from "@ledgerhq/device-transport-kit-react-native-hid";

const DmkContext = createContext<DeviceManagementKit | null>(null);

/** The mock server session whose devices the DMK lists next to real ones. */
export type DmkMockServer = { url: string; token: string };

function buildDefaultDmk(mockServer: DmkMockServer | undefined) {
  const connector = RozeniteConnector.getInstance();

  const builder = new DeviceManagementKitBuilder()
    .addTransport(RNBleTransportFactory)
    .addTransport(RNHidTransportFactory);
  if (mockServer) {
    builder.addTransport(
      mockserverTransportFactory(mockServer.url, mockServer.token),
    );
  }
  const dmk = builder
    .addLogger(new ConsoleLogger())
    .addLogger(new DevToolsLogger(connector))
    .build();

  // Create inspector after DMK is built
  const inspector = new DevToolsDmkInspector(connector, dmk);

  return { dmk, inspector };
}

/**
 * Builds the DMK once: a provider for another mock server session is a new
 * one, so the host keys it by that session.
 */
export const DmkProvider: React.FC<
  PropsWithChildren<{ mockServer?: DmkMockServer }>
> = ({ mockServer, children }) => {
  const state = useRef<ReturnType<typeof buildDefaultDmk>>();
  state.current ??= buildDefaultDmk(mockServer);

  useEffect(() => {
    const { dmk, inspector } = state.current!;
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
