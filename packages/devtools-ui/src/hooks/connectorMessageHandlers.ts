import type { Dispatch, SetStateAction } from "react";
import {
  type ConnectedDevice,
  type DeviceSessionState,
  type DiscoveredDevice,
} from "@ledgerhq/device-management-kit";
import {
  type DevToolsModule,
  parseConnectedDevice,
  parseDeviceSessionState,
  parseDiscoveredDevice,
} from "@ledgerhq/device-management-kit-devtools-core";

import { mapConnectorMessageToLogData } from "../screens/logger/mapConnectorMessageToLogData";
import { type LogData } from "../screens/logger/types";
import { type ApduResponse } from "./useConnectorMessages";

/**
 * Handle module connected handshake message.
 */
export function handleModuleConnected(
  payload: string,
  setConnectedModules: Dispatch<SetStateAction<Set<DevToolsModule>>>,
): void {
  try {
    const { module } = JSON.parse(payload) as { module: DevToolsModule };
    setConnectedModules((prev) => new Set([...prev, module]));
  } catch (e) {
    console.error("Failed to parse moduleConnected payload", e);
  }
}

/**
 * Handle log message. Returns true if message was a log, false otherwise.
 */
export function handleLogMessage(
  type: string,
  payload: string,
  setLogs: Dispatch<SetStateAction<LogData[]>>,
): boolean {
  const logData = mapConnectorMessageToLogData({ type, payload });
  if (logData !== null) {
    setLogs((prev) => [...prev, logData]);
    return true;
  }
  return false;
}

/**
 * Handle connected devices update message.
 */
export function handleConnectedDevicesUpdate(
  payload: string,
  setConnectedDevices: Dispatch<SetStateAction<ConnectedDevice[]>>,
): void {
  try {
    const rawDevices = JSON.parse(payload) as unknown[];
    const devices = rawDevices.map(parseConnectedDevice);
    setConnectedDevices(devices);
  } catch (e) {
    console.error("Failed to parse connectedDevicesUpdate payload", e);
  }
}

/**
 * Handle device session state update message.
 */
export function handleDeviceSessionStateUpdate(
  payload: string,
  setSessionStates: Dispatch<SetStateAction<Map<string, DeviceSessionState>>>,
): void {
  try {
    const { sessionId, state } = JSON.parse(payload) as {
      sessionId: string;
      state: unknown;
    };
    setSessionStates((prev) =>
      new Map(prev).set(sessionId, parseDeviceSessionState(state)),
    );
  } catch (e) {
    console.error("Failed to parse deviceSessionStateUpdate payload", e);
  }
}

/**
 * Handle discovered devices update message.
 */
export function handleDiscoveredDevicesUpdate(
  payload: string,
  setDiscoveredDevices: Dispatch<SetStateAction<DiscoveredDevice[]>>,
): void {
  try {
    const rawDevices = JSON.parse(payload) as unknown[];
    const devices = rawDevices.map(parseDiscoveredDevice);
    setDiscoveredDevices(devices);
  } catch (e) {
    console.error("Failed to parse discoveredDevicesUpdate payload", e);
  }
}

/**
 * Handle provider value response message.
 */
export function handleProviderValue(
  payload: string,
  setProviderValue: Dispatch<SetStateAction<number | null>>,
): void {
  try {
    const { provider } = JSON.parse(payload) as { provider: number };
    setProviderValue(provider);
  } catch (e) {
    console.error("Failed to parse providerValue payload", e);
  }
}

/**
 * Handle APDU response message.
 */
export function handleApduResponse(
  payload: string,
  setApduResponses: Dispatch<SetStateAction<Map<string, ApduResponse>>>,
): void {
  try {
    const response = JSON.parse(payload) as ApduResponse;
    setApduResponses((prev) => new Map(prev).set(response.requestId, response));
  } catch (e) {
    console.error("Failed to parse apduResponse payload", e);
  }
}
