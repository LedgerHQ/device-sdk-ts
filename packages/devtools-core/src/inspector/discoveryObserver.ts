import {
  type DeviceManagementKit,
  type DiscoveredDevice,
} from "@ledgerhq/device-management-kit";
import { type Subscription } from "rxjs";

import { type Connector } from "../types";
import { INSPECTOR_MESSAGE_TYPES } from "./constants";
import { serializeDiscoveredDevice } from "./serialization";

/**
 * Callback type for when discovered devices are updated.
 */
export type OnDiscoveredDevicesUpdate = (devices: DiscoveredDevice[]) => void;

/**
 * Sends the list of discovered devices to the dashboard.
 */
export function sendDiscoveredDevicesUpdate(
  devices: DiscoveredDevice[],
  connector: Connector,
): void {
  connector.sendMessage(
    INSPECTOR_MESSAGE_TYPES.DISCOVERED_DEVICES_UPDATE,
    JSON.stringify(devices.map(serializeDiscoveredDevice)),
  );
}

/**
 * Starts listening to available devices (passive discovery).
 * Uses listenToAvailableDevices which returns the current list of known devices.
 * Does NOT trigger permission prompts - works with already-paired devices.
 *
 * @param dmk - The Device Management Kit instance
 * @param connector - The connector to send messages to the dashboard
 * @param onDevicesUpdate - Optional callback when devices are updated (used to track current devices)
 * @returns A cleanup function to stop listening
 */
export function startListeningObserver(
  dmk: DeviceManagementKit,
  connector: Connector,
  onDevicesUpdate?: OnDiscoveredDevicesUpdate,
): () => void {
  let subscription: Subscription | null = null;

  subscription = dmk.listenToAvailableDevices({}).subscribe({
    next: (devices: DiscoveredDevice[]) => {
      sendDiscoveredDevicesUpdate(devices, connector);
      onDevicesUpdate?.(devices);
    },
    error: (err) => {
      console.error(
        "[DevToolsDmkInspector] listenToAvailableDevices error",
        err,
      );
    },
  });

  // Return cleanup function
  return () => {
    if (subscription) {
      subscription.unsubscribe();
      subscription = null;
    }
  };
}

/**
 * Starts active device discovery.
 * Uses startDiscovering which triggers permission prompts in web apps.
 * NOTE: In web apps (WebHID/WebBLE), this requires a user gesture in the app context.
 * Calling this from the dashboard will NOT work for web apps.
 *
 * @param dmk - The Device Management Kit instance
 * @param connector - The connector to send messages to the dashboard
 * @param onDevicesUpdate - Optional callback when devices are updated (used to track current devices)
 * @returns A cleanup function to stop discovering
 */
export function startDiscoveringObserver(
  dmk: DeviceManagementKit,
  connector: Connector,
  onDevicesUpdate?: OnDiscoveredDevicesUpdate,
): () => void {
  let subscription: Subscription | null = null;
  const discoveredDevices: DiscoveredDevice[] = [];

  subscription = dmk.startDiscovering({}).subscribe({
    next: (device: DiscoveredDevice) => {
      // Accumulate devices (avoid duplicates by id)
      const existingIndex = discoveredDevices.findIndex(
        (d) => d.id === device.id,
      );
      if (existingIndex >= 0) {
        discoveredDevices[existingIndex] = device;
      } else {
        discoveredDevices.push(device);
      }
      sendDiscoveredDevicesUpdate([...discoveredDevices], connector);
      onDevicesUpdate?.([...discoveredDevices]);
    },
    error: (err) => {
      console.error("[DevToolsDmkInspector] startDiscovering error", err);
    },
    complete: () => {
      // Discovery completed (user closed picker or similar)
    },
  });

  // Return cleanup function
  return () => {
    if (subscription) {
      subscription.unsubscribe();
      subscription = null;
    }
    void dmk.stopDiscovering();
  };
}
