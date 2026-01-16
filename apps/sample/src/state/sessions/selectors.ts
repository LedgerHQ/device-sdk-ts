import {
  type ConnectedDevice,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";

import { type RootState } from "@/state/store";

export const selectSelectedSessionId = (state: RootState) =>
  state.sessions.selectedSessionId;

export const selectOrderedConnectedDevices = (
  state: RootState,
): Array<{ sessionId: DeviceSessionId; connectedDevice: ConnectedDevice }> =>
  state.sessions.activeSessions.map((sessionId) => ({
    sessionId,
    connectedDevice: state.sessions.connectedDevices[sessionId],
  }));
