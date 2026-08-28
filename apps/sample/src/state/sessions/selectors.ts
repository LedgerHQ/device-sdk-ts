import {
  type ConnectedDevice,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";
import { createSelector } from "@reduxjs/toolkit";

import { type RootState } from "@/state/store";

export const selectSelectedSessionId = (state: RootState) =>
  state.sessions.selectedSessionId;

const selectActiveSessions = (state: RootState) =>
  state.sessions.activeSessions;
const selectConnectedDevices = (state: RootState) =>
  state.sessions.connectedDevices;

/**
 * Memoized: the pairing is built by mapping, so an unmemoized version would
 * hand every subscriber a new array on each store change and rerender them all.
 */
export const selectOrderedConnectedDevices = createSelector(
  [selectActiveSessions, selectConnectedDevices],
  (
    activeSessions,
    connectedDevices,
  ): Array<{
    sessionId: DeviceSessionId;
    connectedDevice: ConnectedDevice;
  }> =>
    activeSessions.map((sessionId) => ({
      sessionId,
      connectedDevice: connectedDevices[sessionId],
    })),
);
