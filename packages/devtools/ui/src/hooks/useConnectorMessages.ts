/**
 * @file useConnectorMessages hook
 *
 * Central hook for managing DevTools connector state and actions.
 * Handles all communication between the Dashboard UI and the client app
 * via the connector (WebSocket or Rozenite).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
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
  MODULE_CONNECTED_MESSAGE_TYPE,
} from "@ledgerhq/device-management-kit-devtools-core";

import { type Message } from "../PluginEvents";
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

export type ConnectorMessagesState = {
  receivedMessages: Message[];
  sentMessages: Message[];
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
  const [receivedMessages, setReceivedMessages] = useState<Message[]>([]);
  const [sentMessages, setSentMessages] = useState<Message[]>([]);
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

  // === Tracked Connector (keeps all sent messages in state) ===
  const trackedConnector: Connector = useMemo(
    () => ({
      ...connector,
      sendMessage: (type: string, payload: string) => {
        connector.sendMessage(type, payload);
        setSentMessages((prev) => [...prev, { type, payload }]);
      },
    }),
    [connector],
  );

  // === Message Listener ===
  useEffect(() => {
    const { unsubscribe } = connector.listenToMessages((type, payload) => {
      setReceivedMessages((prev) => [...prev, { type, payload }]);

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
        default:
          // Try to handle as log message
          handleLogMessage(type, payload, setLogs);
          break;
      }
    });
    return unsubscribe;
  }, [connector]);

  // === Commands (using tracked connector to log all sent messages) ===
  const discoveryCommands = useMemo(
    () => createDiscoveryCommands(trackedConnector),
    [trackedConnector],
  );
  const providerCommands = useMemo(
    () => createProviderCommands(trackedConnector),
    [trackedConnector],
  );
  const apduCommands = useMemo(
    () => createApduCommands(trackedConnector),
    [trackedConnector],
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
    setLogs([]);
  }, []);

  // === Derived State ===
  const isLoggerConnected = connectedModules.has(DEVTOOLS_MODULES.LOGGER);
  const isInspectorConnected = connectedModules.has(
    DEVTOOLS_MODULES.DMK_INSPECTOR,
  );

  return {
    // State
    receivedMessages,
    sentMessages,
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
    // Actions
    sendMessage: trackedConnector.sendMessage,
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
