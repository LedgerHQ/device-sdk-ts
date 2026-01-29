import {
  type DeviceManagementKit,
  type DeviceSessionId,
  type DeviceSessionState,
} from "@ledgerhq/device-management-kit";
import { type Subscription } from "rxjs";

import { type Connector } from "../types";
import { INSPECTOR_MESSAGE_TYPES } from "./constants";
import {
  serializeConnectedDevice,
  serializeDeviceSessionState,
} from "./serialization";

/**
 * Sends the current list of connected devices to the dashboard.
 */
export function sendConnectedDevicesUpdate(
  dmk: DeviceManagementKit,
  connector: Connector,
): void {
  const devices = dmk.listConnectedDevices();
  connector.sendMessage(
    INSPECTOR_MESSAGE_TYPES.CONNECTED_DEVICES_UPDATE,
    JSON.stringify(devices.map(serializeConnectedDevice)),
  );
}

/**
 * Sends a device session state update to the dashboard.
 */
export function sendSessionStateUpdate(
  connector: Connector,
  sessionId: DeviceSessionId,
  state: DeviceSessionState,
): void {
  connector.sendMessage(
    INSPECTOR_MESSAGE_TYPES.DEVICE_SESSION_STATE_UPDATE,
    JSON.stringify({
      sessionId,
      state: serializeDeviceSessionState(state),
    }),
  );
}

/**
 * Creates a device observer that tracks connected devices and their session states.
 * Returns a cleanup function to unsubscribe from all observations.
 */
export function createDeviceObserver(
  dmk: DeviceManagementKit,
  connector: Connector,
): () => void {
  const subscriptions: Subscription[] = [];
  const sessionStateSubscriptions = new Map<DeviceSessionId, Subscription>();

  const subscribeToSessionState = (sessionId: DeviceSessionId): void => {
    // Don't double-subscribe
    if (sessionStateSubscriptions.has(sessionId)) {
      return;
    }

    const sub = dmk.getDeviceSessionState({ sessionId }).subscribe({
      next: (state: DeviceSessionState) => {
        sendSessionStateUpdate(connector, sessionId, state);
      },
      error: (err) => {
        console.error(
          `[DevToolsDmkInspector] getDeviceSessionState error for ${sessionId}`,
          err,
        );
        sessionStateSubscriptions.delete(sessionId);
      },
      complete: () => {
        // Session ended, clean up and send updated device list
        sessionStateSubscriptions.delete(sessionId);
        sendConnectedDevicesUpdate(dmk, connector);
      },
    });

    sessionStateSubscriptions.set(sessionId, sub);
  };

  // Send initial list of connected devices
  sendConnectedDevicesUpdate(dmk, connector);

  // Subscribe to new device connections
  const deviceSub = dmk.listenToConnectedDevice().subscribe({
    next: (device) => {
      sendConnectedDevicesUpdate(dmk, connector);
      subscribeToSessionState(device.sessionId);
    },
    error: (err) => {
      console.error(
        "[DevToolsDmkInspector] listenToConnectedDevice error",
        err,
      );
    },
  });
  subscriptions.push(deviceSub);

  // Subscribe to existing devices' session states
  const existingDevices = dmk.listConnectedDevices();
  existingDevices.forEach((device) => {
    subscribeToSessionState(device.sessionId);
  });

  // Return cleanup function
  return () => {
    for (const sub of subscriptions) {
      sub.unsubscribe();
    }
    for (const sub of sessionStateSubscriptions.values()) {
      sub.unsubscribe();
    }
    sessionStateSubscriptions.clear();
  };
}
