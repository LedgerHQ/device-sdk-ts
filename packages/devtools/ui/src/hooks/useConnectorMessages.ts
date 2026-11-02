/**
 * @file useConnectorMessages hook
 *
 * Central hook for managing DevTools connector state and actions.
 * Handles all communication between the Dashboard UI and the client app
 * via the connector (WebSocket or Rozenite).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type ConnectedDevice,
  type DeviceSessionState,
  type DiscoveredDevice,
} from "@ledgerhq/device-management-kit";
import {
  type Connector,
  DEVTOOLS_MODULES,
  type DevToolsModule,
  INSPECTOR_MESSAGE_TYPES,
  LOGGER_MESSAGE_TYPES,
  MODULE_CONNECTED_MESSAGE_TYPE,
} from "@ledgerhq/device-management-kit-devtools-core";

import { type LogData } from "../screens/logger/types";
import {
  createApduCommands,
  createDiscoveryCommands,
  createProviderCommands,
} from "./commandDispatcher";
import {
  handleApduResponse,
  handleConnectedDevicesUpdate,
  handleDeviceSessionStateUpdate,
  handleDiscoveredDevicesUpdate,
  handleLogMessage,
  handleMockServerConfig,
  handleModuleConnected,
  handleProviderValue,
} from "./connectorMessageHandlers";

// ============================================================================
// Types
// ============================================================================

export type ApduResponse = {
  requestId: string;
  success: boolean;
  statusCode?: number[];
  data?: number[];
  error?: string;
};

export type MockServerConfig = {
  url: string;
  sessionToken?: string;
};

export type ConnectorMessagesState = {
  logs: LogData[];
  connectedModules: Set<DevToolsModule>;
  connectedDevices: ConnectedDevice[];
  sessionStates: Map<string, DeviceSessionState>;
  discoveredDevices: DiscoveredDevice[];
  isListening: boolean;
  isActivelyDiscovering: boolean;
  isLoggerConnected: boolean;
  isInspectorConnected: boolean;
  providerValue: number | null;
  apduResponses: Map<string, ApduResponse>;
  mockServer: MockServerConfig | null;
  sendMessage: (type: string, payload: string) => void;
  clearLogs: () => void;
  startListening: () => void;
  stopListening: () => void;
  startDiscovering: () => void;
  stopDiscovering: () => void;
  connectDevice: (
    deviceId: string,
    sessionRefresherOptions?: {
      isRefresherDisabled: boolean;
      pollingInterval?: number;
    },
  ) => void;
  getProvider: () => void;
  setProvider: (value: number) => void;
  sendApdu: (sessionId: string, apduHex: string) => string;
};

// ============================================================================
// Hook
// ============================================================================

const FLUSH_INTERVAL_MS = 250;
// Every view rescans the logs on each flush, so a long session must not grow them forever
const MAX_LOGS = 20_000;

/**
 * Central hook for managing DevTools connector state and communication.
 *
 * This hook:
 * - Listens to messages from the connector and dispatches them to handlers
 * - Tracks all sent/received messages for debugging
 * - Manages device discovery, sessions, and DMK configuration state
 * - Provides action functions to send commands to the inspector module
 *
 * @param connector - The connector instance (WebSocket or Rozenite)
 * @returns State and actions for the Dashboard UI
 */
export function useConnectorMessages(
  connector: Connector,
): ConnectorMessagesState {
  // === State ===
  const [logs, setLogs] = useState<LogData[]>([]);
  const [connectedModules, setConnectedModules] = useState<Set<DevToolsModule>>(
    new Set(),
  );
  const [connectedDevices, setConnectedDevices] = useState<ConnectedDevice[]>(
    [],
  );
  const [sessionStates, setSessionStates] = useState<
    Map<string, DeviceSessionState>
  >(new Map());
  const [discoveredDevices, setDiscoveredDevices] = useState<
    DiscoveredDevice[]
  >([]);
  const [isListening, setIsListening] = useState(false);
  const [isActivelyDiscovering, setIsActivelyDiscovering] = useState(false);
  const [providerValue, setProviderValue] = useState<number | null>(null);
  const [apduResponses, setApduResponses] = useState<Map<string, ApduResponse>>(
    new Map(),
  );
  const [mockServer, setMockServer] = useState<MockServerConfig | null>(null);

  // Shared with clearLogs, so a clear also drops the logs waiting for the next flush
  const pendingLogsRef = useRef<LogData[]>([]);

  // === Message Listener ===
  useEffect(() => {
    // Logs are added in batches, like Dozzle: a polling device sends several logs
    // per second, and adding them one by one re-rendered the dashboard for every line.
    let flushTimer: ReturnType<typeof setTimeout> | undefined;
    const flush = () => {
      flushTimer = undefined;
      const newLogs = pendingLogsRef.current;
      pendingLogsRef.current = [];
      if (newLogs.length > 0) {
        setLogs((prev) => [...prev, ...newLogs].slice(-MAX_LOGS));
      }
    };

    const { unsubscribe } = connector.listenToMessages((type, payload) => {
      flushTimer ??= setTimeout(flush, FLUSH_INTERVAL_MS);

      switch (type) {
        case MODULE_CONNECTED_MESSAGE_TYPE:
          handleModuleConnected(payload, setConnectedModules);
          break;
        case INSPECTOR_MESSAGE_TYPES.CONNECTED_DEVICES_UPDATE:
          handleConnectedDevicesUpdate(payload, setConnectedDevices);
          break;
        case INSPECTOR_MESSAGE_TYPES.DEVICE_SESSION_STATE_UPDATE:
          handleDeviceSessionStateUpdate(payload, setSessionStates);
          break;
        case INSPECTOR_MESSAGE_TYPES.DISCOVERED_DEVICES_UPDATE:
          handleDiscoveredDevicesUpdate(payload, setDiscoveredDevices);
          break;
        case INSPECTOR_MESSAGE_TYPES.PROVIDER_VALUE:
          handleProviderValue(payload, setProviderValue);
          break;
        case INSPECTOR_MESSAGE_TYPES.APDU_RESPONSE:
          handleApduResponse(payload, setApduResponses);
          break;
        case INSPECTOR_MESSAGE_TYPES.MOCK_SERVER_CONFIG:
          handleMockServerConfig(payload, setMockServer);
          break;
        case LOGGER_MESSAGE_TYPES.ADD_LOG:
          handleLogMessage(payload, (log) => pendingLogsRef.current.push(log));
          break;
      }
    });
    return () => {
      unsubscribe();
      clearTimeout(flushTimer);
    };
  }, [connector]);

  // === Commands (using tracked connector to log all sent messages) ===
  const discoveryCommands = useMemo(
    () => createDiscoveryCommands(connector),
    [connector],
  );
  const providerCommands = useMemo(
    () => createProviderCommands(connector),
    [connector],
  );
  const apduCommands = useMemo(
    () => createApduCommands(connector),
    [connector],
  );

  // === Wrapped Commands (with local state updates) ===
  const startListening = useCallback(() => {
    setIsListening(true);
    setDiscoveredDevices([]);
    discoveryCommands.startListeningCommand();
  }, [discoveryCommands]);

  const stopListening = useCallback(() => {
    setIsListening(false);
    setDiscoveredDevices([]);
    discoveryCommands.stopListeningCommand();
  }, [discoveryCommands]);

  const startDiscovering = useCallback(() => {
    setIsActivelyDiscovering(true);
    setDiscoveredDevices([]);
    discoveryCommands.startDiscoveringCommand();
  }, [discoveryCommands]);

  const stopDiscovering = useCallback(() => {
    setIsActivelyDiscovering(false);
    setDiscoveredDevices([]);
    discoveryCommands.stopDiscoveringCommand();
  }, [discoveryCommands]);

  const clearLogs = useCallback(() => {
    pendingLogsRef.current = [];
    setLogs([]);
  }, []);

  // === Derived State ===
  const isLoggerConnected = connectedModules.has(DEVTOOLS_MODULES.LOGGER);
  const isInspectorConnected = connectedModules.has(
    DEVTOOLS_MODULES.DMK_INSPECTOR,
  );

  return {
    // State
    logs,
    connectedModules,
    connectedDevices,
    sessionStates,
    discoveredDevices,
    isListening,
    isActivelyDiscovering,
    isLoggerConnected,
    isInspectorConnected,
    providerValue,
    apduResponses,
    mockServer,
    // Actions
    sendMessage: connector.sendMessage,
    clearLogs,
    startListening,
    stopListening,
    startDiscovering,
    stopDiscovering,
    connectDevice: discoveryCommands.connectDeviceCommand,
    getProvider: providerCommands.getProviderCommand,
    setProvider: providerCommands.setProviderCommand,
    sendApdu: apduCommands.sendApduCommand,
  };
}
