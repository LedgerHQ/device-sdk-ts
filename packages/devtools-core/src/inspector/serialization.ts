import {
  type ConnectedDevice,
  type DeviceSessionState,
  DeviceSessionStateType,
  type DiscoveredDevice,
} from "@ledgerhq/device-management-kit";

/**
 * Serialize a ConnectedDevice to a plain object for JSON transmission.
 */
export function serializeConnectedDevice(
  device: ConnectedDevice,
): ConnectedDevice {
  return JSON.parse(JSON.stringify(device)) as ConnectedDevice;
}

/**
 * Serialize a DeviceSessionState to a plain object for JSON transmission.
 * Converts enum values to their string names for readability.
 */
export function serializeDeviceSessionState(
  state: DeviceSessionState,
): DeviceSessionState {
  const serialized = JSON.parse(JSON.stringify(state)) as Record<
    string,
    unknown
  >;
  // Convert enum to string name for readability
  serialized["sessionStateType"] =
    DeviceSessionStateType[state.sessionStateType];
  return serialized as DeviceSessionState;
}

/**
 * Serialize a DiscoveredDevice to a plain object for JSON transmission.
 */
export function serializeDiscoveredDevice(
  device: DiscoveredDevice,
): DiscoveredDevice {
  return JSON.parse(JSON.stringify(device)) as DiscoveredDevice;
}
