import {
  type ConnectedDevice,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";

export type SessionsState = {
  activeSessions: DeviceSessionId[];
  connectedDevices: Record<DeviceSessionId, ConnectedDevice>;
  selectedSessionId: DeviceSessionId | null;
};

export const initialState: SessionsState = {
  activeSessions: [],
  connectedDevices: {},
  selectedSessionId: null,
};
