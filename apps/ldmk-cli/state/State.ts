import type { DeviceId, DeviceSessionId, DeviceStatus, DiscoveredDevice } from "@ledgerhq/device-management-kit";
import { Subscription } from "rxjs";

export interface AppState {
  subscriptions: Subscription[];
  discoveredDevices: Map<DeviceId, DiscoveredDevice>;
  sessionId: DeviceSessionId | null;
  deviceStatus: DeviceStatus | null;
  selectedDeviceName: DiscoveredDevice['name'] | null;
}

export const state: AppState = {
  discoveredDevices: new Map(),
  sessionId: null,
  selectedDeviceName: null,
  deviceStatus: null,
  subscriptions: [],
};
