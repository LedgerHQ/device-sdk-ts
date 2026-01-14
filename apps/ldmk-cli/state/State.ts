import type { DeviceId, DeviceSessionId, DeviceStatus, DiscoveredDevice } from "@ledgerhq/device-management-kit";
import { Subscription } from "rxjs";

export interface AppState {
  subscriptions: Subscription[];
  connectedDevices: Map<DeviceId, DiscoveredDevice>;
  sessionId: DeviceSessionId | null;
  deviceStatus: DeviceStatus | null;
  selectedDeviceName: DiscoveredDevice['name'] | null;
}

export const state: AppState = {
  connectedDevices: new Map(),
  sessionId: null,
  selectedDeviceName: null,
  deviceStatus: null,
  subscriptions: [],
};
