import "zx/globals";
import { state } from "./State";
import { DeviceStatus } from "@ledgerhq/device-management-kit";

export const deviceConnected = (): boolean => {
  if (state.sessionId === null || state.deviceStatus === DeviceStatus.NOT_CONNECTED) {
    return false;
  }
  return true;
};

export const deviceLocked = (): boolean => {
  if (state.deviceStatus === DeviceStatus.LOCKED) {
    return true;
  }
  return false;
};