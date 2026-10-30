import type { Dispatch, SetStateAction } from "react";
import {
  type ConnectedDevice,
  type DeviceSessionState,
  type DiscoveredDevice,
} from "@ledgerhq/device-management-kit";
import { type DevToolsModule } from "@ledgerhq/device-management-kit-devtools-core";

import { mapConnectorMessageToLogData } from "../screens/logger/mapConnectorMessageToLogData";
import { type LogData } from "../screens/logger/types";
import {
  type ApduResponse,
  type MockServerConfig,
} from "./useConnectorMessages";

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
  payload: string,
  addLog: (log: LogData) => void,
): boolean {
  const logData = mapConnectorMessageToLogData(payload);
  if (logData !== null) {
    addLog(logData);
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
    const devices = JSON.parse(payload) as ConnectedDevice[];
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
      state: DeviceSessionState;
    };
    setSessionStates((prev) => new Map(prev).set(sessionId, state));
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
    const devices = JSON.parse(payload) as DiscoveredDevice[];
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

// Parseable, over HTTP(S) and with a host: anything else would break the screen or the proxy
const isWebUrl = (url: string): boolean => {
  try {
    const { protocol, host } = new URL(url);
    return (protocol === "http:" || protocol === "https:") && host !== "";
  } catch {
    return false;
  }
};

/**
 * The mock server config the app sent, `null` when it has none, or `undefined`
 * when the message is not one: it comes from the app, so its shape is checked.
 */
export function parseMockServerConfig(
  payload: string,
): MockServerConfig | null | undefined {
  try {
    const config: unknown = JSON.parse(payload);
    if (config === null) return null;
    if (typeof config !== "object") return undefined;
    const { url, sessionToken } = config as Record<string, unknown>;
    if (typeof url !== "string" || !isWebUrl(url)) return undefined;
    if (sessionToken !== undefined && typeof sessionToken !== "string") {
      return undefined;
    }
    return sessionToken === undefined ? { url } : { url, sessionToken };
  } catch {
    return undefined;
  }
}

/**
 * Handle mock server config message.
 */
export function handleMockServerConfig(
  payload: string,
  setMockServer: Dispatch<SetStateAction<MockServerConfig | null>>,
): void {
  const config = parseMockServerConfig(payload);
  if (config === undefined) {
    // Not the payload: a rejected config can still hold a valid session token
    console.error("Ignored an invalid mockServerConfig payload");
    return;
  }
  setMockServer(config);
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
