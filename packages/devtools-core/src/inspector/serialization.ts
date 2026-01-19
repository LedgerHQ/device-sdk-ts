import {
  type ConnectedDevice,
  type DeviceSessionState,
  DeviceSessionStateType,
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
 * Parse a serialized ConnectedDevice.
 */
export function parseConnectedDevice(data: unknown): ConnectedDevice {
  return data as ConnectedDevice;
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
 * Parse a serialized DeviceSessionState.
 * Note: sessionStateType will be a string (enum name), not the enum value.
 */
export function parseDeviceSessionState(data: unknown): DeviceSessionState {
  return data as DeviceSessionState;
}
