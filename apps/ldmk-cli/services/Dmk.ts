import { DeviceManagementKitBuilder } from "@ledgerhq/device-management-kit";
import { nodeHidTransportFactory } from "@ledgerhq/device-transport-kit-node-hid";
import type { DeviceManagementKit } from "@ledgerhq/device-management-kit";
import { DevToolsLogger } from "@ledgerhq/device-management-kit-devtools-core";
import { DEFAULT_CLIENT_WS_URL } from "@ledgerhq/device-management-kit-devtools-websocket-common";
import { DevtoolsWebSocketConnector } from "@ledgerhq/device-management-kit-devtools-websocket-connector";
import { FileLogger } from "../logger/FileLogger";


let dmkInstance: DeviceManagementKit | null = null;

const devToolsWebSocketConnector = DevtoolsWebSocketConnector.getInstance().connect({
  url: DEFAULT_CLIENT_WS_URL,
});

const devToolsLogger = new DevToolsLogger(devToolsWebSocketConnector);

export const useDmk = (): DeviceManagementKit => {
  if (!dmkInstance) {
    dmkInstance = new DeviceManagementKitBuilder()
      .addTransport(nodeHidTransportFactory)
      .addLogger(new FileLogger())
      .addLogger(devToolsLogger)
      .build();
  }
  return dmkInstance;
};

export const resetDmk = (): void => {
  if (dmkInstance) {
    dmkInstance.close();
    dmkInstance = null;
  }
};
