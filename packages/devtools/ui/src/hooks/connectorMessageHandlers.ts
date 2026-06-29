import type { Dispatch, SetStateAction } from "react";
import {
  type ConnectedDevice,
  type DeviceSessionState,
  type DiscoveredDevice,
} from "@ledgerhq/device-management-kit";
import { type DevToolsModule } from "@ledgerhq/device-management-kit-devtools-core";

import { mapConnectorMessageToLogData } from "../screens/logger/mapConnectorMessageToLogData";
import { type LogData } from "../screens/logger/types";
import { type ApduExchange, type ApduResponse } from "./useConnectorMessages";

const APDU_EXCHANGE_LOG = "apdu-exchange";

/**
 * Extracts a structured APDU exchange from a log message, if the log carries
 * the `apdu-exchange` payload emitted by DMK. Returns null otherwise.
 */
function tryExtractApduExchange(logData: LogData): ApduExchange | null {
  const data = logData.payload;
  if (
    typeof data !== "object" ||
    data === null ||
    Array.isArray(data) ||
    data["type"] !== APDU_EXCHANGE_LOG ||
    typeof data["apdu"] !== "string" ||
    typeof data["response"] !== "string"
  ) {
    return null;
  }
  return {
    sessionId:
      typeof data["sessionId"] === "string" ? data["sessionId"] : undefined,
    apdu: data["apdu"],
    response: data["response"],
    timestamp: logData.timestamp,
  };
}

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
  setLogs: Dispatch<SetStateAction<LogData[]>>,
  setApduExchanges: Dispatch<SetStateAction<ApduExchange[]>>,
  isRecordingExchanges: boolean,
): boolean {
  const logData = mapConnectorMessageToLogData(payload);
  if (logData !== null) {
    setLogs((prev) => [...prev, logData]);
    if (isRecordingExchanges) {
      const exchange = tryExtractApduExchange(logData);
      if (exchange !== null) {
        setApduExchanges((prev) => [...prev, exchange]);
      }
    }
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
