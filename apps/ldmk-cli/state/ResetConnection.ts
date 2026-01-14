import { state } from "./State";

export const resetConnection = (): void => {
  state.sessionId = null;
  state.selectedDeviceName = null;
  state.deviceStatus = null;
};
