import { Connector } from "@ledgerhq/device-management-kit-devtools-core";
import { useRozeniteDevToolsClient } from "@rozenite/plugin-bridge";
import { useState, useEffect } from "react";
import { PluginEvents } from "./PluginEvents";
import { RozeniteConnector } from "./RozeniteConnector";
import { pluginId } from "./pluginId";

export function useRozeniteConnector(): Connector | null {
  const client = useRozeniteDevToolsClient<PluginEvents>({ pluginId });
  const [connector, setConnector] = useState<RozeniteConnector | null>(null);

  useEffect(() => {
    if (client) {
      const connector = RozeniteConnector.getInstance();
      connector.setClient(client);
      setConnector(connector);
    }
  }, [client]);
  return connector;
}
