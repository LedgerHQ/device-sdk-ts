import { DeviceManagementKitBuilder } from "@ledgerhq/device-management-kit";
import { nodeHidTransportFactory } from "@ledgerhq/device-transport-kit-node-hid";
import type { DeviceManagementKit } from "@ledgerhq/device-management-kit";
import { FileLogger } from "../logger/FileLogger";

let dmkInstance: DeviceManagementKit | null = null;

export const useDmk = (): DeviceManagementKit => {
  if (!dmkInstance) {
    dmkInstance = new DeviceManagementKitBuilder()
      .addTransport(nodeHidTransportFactory)
      .addLogger(new FileLogger())
      .build();
  }
  return dmkInstance;
};
