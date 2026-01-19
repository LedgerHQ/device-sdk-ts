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
  createApduActions,
  createDebugActions,
  createDiscoveryActions,
  createProviderActions,
} from "./connectorActions";
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
  connectDevice: (deviceId: string) => void;
  getProvider: () => void;
  setProvider: (value: number) => void;
  sendApdu: (sessionId: string, apduHex: string) => string;
};

// ============================================================================
// Hook
// ============================================================================

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

  // === Actions ===
  const discoveryActions = useMemo(
    () => createDiscoveryActions(connector),
    [connector],
  );
  const providerActions = useMemo(
    () => createProviderActions(connector),
    [connector],
  );
  const apduActions = useMemo(() => createApduActions(connector), [connector]);
  const debugActions = useMemo(
    () =>
      createDebugActions(connector, (type, payload) => {
        setSentMessages((prev) => [...prev, { type, payload }]);
      }),
    [connector],
  );

  // === Wrapped Actions (with local state updates) ===
  const startListening = useCallback(() => {
    setIsListening(true);
    setDiscoveredDevices([]);
    discoveryActions.startListeningCommand();
  }, [discoveryActions]);

  const stopListening = useCallback(() => {
    setIsListening(false);
    setDiscoveredDevices([]);
    discoveryActions.stopListeningCommand();
  }, [discoveryActions]);

  const startDiscovering = useCallback(() => {
    setIsActivelyDiscovering(true);
    setDiscoveredDevices([]);
    discoveryActions.startDiscoveringCommand();
  }, [discoveryActions]);

  const stopDiscovering = useCallback(() => {
    setIsActivelyDiscovering(false);
    setDiscoveredDevices([]);
    discoveryActions.stopDiscoveringCommand();
  }, [discoveryActions]);

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
    sendMessage: debugActions.sendMessageCommand,
    clearLogs,
    startListening,
    stopListening,
    startDiscovering,
    stopDiscovering,
    connectDevice: discoveryActions.connectDeviceCommand,
    getProvider: providerActions.getProviderCommand,
    setProvider: providerActions.setProviderCommand,
    sendApdu: apduActions.sendApduCommand,
  };
}
