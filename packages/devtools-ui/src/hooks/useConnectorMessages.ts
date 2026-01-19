import { useCallback, useEffect, useState } from "react";
import {
  type ConnectedDevice,
  type DeviceSessionState,
} from "@ledgerhq/device-management-kit";
import {
  type Connector,
  DEVTOOLS_MODULES,
  type DevToolsModule,
  INSPECTOR_MESSAGE_TYPES,
  MODULE_CONNECTED_MESSAGE_TYPE,
  parseConnectedDevice,
  parseDeviceSessionState,
} from "@ledgerhq/device-management-kit-devtools-core";

import { type Message } from "../PluginEvents";
import { mapConnectorMessageToLogData } from "../screens/logger/mapConnectorMessageToLogData";
import { type LogData } from "../screens/logger/types";

export type ConnectorMessagesState = {
  receivedMessages: Message[];
  sentMessages: Message[];
  logs: LogData[];
  connectedModules: Set<DevToolsModule>;
  connectedDevices: ConnectedDevice[];
  sessionStates: Map<string, DeviceSessionState>;
  isLoggerConnected: boolean;
  isInspectorConnected: boolean;
  sendMessage: (type: string, payload: string) => void;
  clearLogs: () => void;
};

export function useConnectorMessages(
  connector: Connector,
): ConnectorMessagesState {
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

  useEffect(() => {
    const { unsubscribe } = connector.listenToMessages((type, payload) => {
      setReceivedMessages((prev) => [...prev, { type, payload }]);

      // Handle module connection handshake
      if (type === MODULE_CONNECTED_MESSAGE_TYPE) {
        try {
          const { module } = JSON.parse(payload) as { module: DevToolsModule };
          setConnectedModules((prev) => new Set([...prev, module]));
        } catch (e) {
          console.error("Failed to parse moduleConnected payload", e);
        }
        return;
      }

      // Handle log messages
      const logData = mapConnectorMessageToLogData({ type, payload });
      if (logData !== null) {
        setLogs((prev) => [...prev, logData]);
        return;
      }

      // Handle inspector messages
      if (type === INSPECTOR_MESSAGE_TYPES.CONNECTED_DEVICES_UPDATE) {
        try {
          const rawDevices = JSON.parse(payload) as unknown[];
          const devices = rawDevices.map(parseConnectedDevice);
          setConnectedDevices(devices);
          // Note: We don't clean up session states here to keep showing
          // disconnected sessions with their last known state
        } catch (e) {
          console.error("Failed to parse connectedDevicesUpdate payload", e);
        }
        return;
      }

      if (type === INSPECTOR_MESSAGE_TYPES.DEVICE_SESSION_STATE_UPDATE) {
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
        return;
      }
    });
    return () => {
      unsubscribe();
    };
  }, [connector]);

  const sendMessage = useCallback(
    (type: string, payload: string) => {
      connector.sendMessage(type, payload);
      setSentMessages((prev) => [...prev, { type, payload }]);
    },
    [connector],
  );

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  const isLoggerConnected = connectedModules.has(DEVTOOLS_MODULES.LOGGER);
  const isInspectorConnected = connectedModules.has(
    DEVTOOLS_MODULES.DMK_INSPECTOR,
  );

  return {
    receivedMessages,
    sentMessages,
    logs,
    connectedModules,
    connectedDevices,
    sessionStates,
    isLoggerConnected,
    isInspectorConnected,
    sendMessage,
    clearLogs,
  };
}
