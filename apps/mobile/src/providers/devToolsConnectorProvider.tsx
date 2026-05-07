import React, { createContext, useContext } from "react";
import { type Connector } from "@ledgerhq/device-management-kit-devtools-core";
import { useRozeniteConnector } from "@ledgerhq/device-management-kit-devtools-rozenite";

const DevToolsConnectorContext = createContext<Connector | null>(null);

export const DevToolsConnectorProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  if (!__DEV__) {
    return (
      <DevToolsConnectorContext.Provider value={null}>
        {children}
      </DevToolsConnectorContext.Provider>
    );
  }

  return (
    <DevToolsConnectorProviderDev>{children}</DevToolsConnectorProviderDev>
  );
};

const DevToolsConnectorProviderDev: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const connector = useRozeniteConnector();
  return (
    <DevToolsConnectorContext.Provider value={connector}>
      {children}
    </DevToolsConnectorContext.Provider>
  );
};

export const useDevToolsConnector = (): Connector | null => {
  const connector = useContext(DevToolsConnectorContext);
  return connector;
};
