import React, { useMemo } from "react";
import {
  type ConnectedDevice,
  type DeviceSessionState,
  type DiscoveredDevice,
} from "@ledgerhq/device-management-kit";
import { INSPECTOR_COMMAND_TYPES } from "@ledgerhq/device-management-kit-devtools-core";
import { Flex, Text } from "@ledgerhq/react-ui";

import { NotConnectedMessage } from "../../shared/NotConnectedMessage";
import { DeviceCard } from "./DeviceCard";
import { DiscoveredDeviceCard } from "./DiscoveredDeviceCard";

type SessionsProps = {
  devices: ConnectedDevice[];
  sessionStates: Map<string, DeviceSessionState>;
  discoveredDevices: DiscoveredDevice[];
  isListening: boolean;
  isActivelyDiscovering: boolean;
  sendMessage: (type: string, payload: string) => void;
  isConnected: boolean;
  startListening: () => void;
  stopListening: () => void;
  startDiscovering: () => void;
  stopDiscovering: () => void;
  connectDevice: (deviceId: string) => void;
};

const INSPECTOR_CODE_EXAMPLE = `import { DevToolsDmkInspector } from "@ledgerhq/device-management-kit-devtools-core";

const dmk = new DeviceManagementKitBuilder()
  .addLogger(logger)
  .build();

// Enable inspector after DMK is built
new DevToolsDmkInspector(connector, dmk);`;

const isDeviceConnected = (
  device: ConnectedDevice,
  sessionStates: Map<string, DeviceSessionState>,
): boolean => {
  const state = sessionStates.get(device.sessionId);
  if (!state) return true; // Assume connected if no state yet
  return state.deviceStatus !== "NOT CONNECTED";
};

export const Sessions: React.FC<SessionsProps> = ({
  devices,
  sessionStates,
  discoveredDevices,
  isListening,
  isActivelyDiscovering,
  sendMessage,
  isConnected,
  startListening,
  stopListening,
  startDiscovering,
  stopDiscovering,
  connectDevice,
}) => {
  const isAnyDiscoveryActive = isListening || isActivelyDiscovering;
  const handleDisconnect = (sessionId: string) => {
    sendMessage(
      INSPECTOR_COMMAND_TYPES.DISCONNECT,
      JSON.stringify({ sessionId }),
    );
  };

  const { activeDevices, disconnectedDevices } = useMemo(() => {
    const active: ConnectedDevice[] = [];
    const disconnected: ConnectedDevice[] = [];

    for (const device of devices) {
      if (isDeviceConnected(device, sessionStates)) {
        active.push(device);
      } else {
        disconnected.push(device);
      }
    }

    return { activeDevices: active, disconnectedDevices: disconnected };
  }, [devices, sessionStates]);

  if (!isConnected) {
    return (
      <NotConnectedMessage
        title="Inspector not connected"
        description={
          <>
            To enable the Sessions inspector, add{" "}
            <code>DevToolsDmkInspector</code> to your app after building the
            DMK:
          </>
        }
        codeExample={INSPECTOR_CODE_EXAMPLE}
      />
    );
  }

  return (
    <Flex flexDirection="column" flex={1} padding={4} overflow="auto">
      {/* Discovery Section */}
      <Flex
        flexDirection="column"
        mb={4}
        pb={4}
        style={{ borderBottom: "1px solid #eee" }}
      >
        <Text variant="h4" mb={3}>
          Device Discovery
        </Text>

        {/* Discovery buttons */}
        <Flex columnGap={3} mb={3}>
          {/* Passive listening */}
          <button
            onClick={isListening ? stopListening : startListening}
            disabled={isActivelyDiscovering}
            style={{
              background: isListening
                ? "#ff9800"
                : isActivelyDiscovering
                  ? "#ccc"
                  : "#2196F3",
              color: "white",
              border: "none",
              borderRadius: 4,
              padding: "8px 16px",
              cursor: isActivelyDiscovering ? "not-allowed" : "pointer",
            }}
          >
            {isListening ? "Stop Listening" : "Listen for Devices"}
          </button>

          {/* Active discovery */}
          <button
            onClick={isActivelyDiscovering ? stopDiscovering : startDiscovering}
            disabled={isListening}
            style={{
              background: isActivelyDiscovering
                ? "#ff9800"
                : isListening
                  ? "#ccc"
                  : "#4CAF50",
              color: "white",
              border: "none",
              borderRadius: 4,
              padding: "8px 16px",
              cursor: isListening ? "not-allowed" : "pointer",
            }}
          >
            {isActivelyDiscovering ? "Stop Discovery" : "Start Discovery"}
          </button>
        </Flex>

        {/* Status message */}
        {isListening && discoveredDevices.length === 0 && (
          <Text variant="body" color="neutral.c70">
            Listening for available devices...
          </Text>
        )}
        {isActivelyDiscovering && discoveredDevices.length === 0 && (
          <Text variant="body" color="neutral.c70">
            Discovering devices...
          </Text>
        )}

        {/* Discovered devices list */}
        {discoveredDevices.length > 0 && (
          <Flex flexDirection="column" rowGap={3}>
            {discoveredDevices.map((device) => (
              <DiscoveredDeviceCard
                key={device.id}
                device={device}
                onConnect={() => connectDevice(device.id)}
              />
            ))}
          </Flex>
        )}

        {!isAnyDiscoveryActive && discoveredDevices.length === 0 && (
          <Text variant="body" color="neutral.c70">
            Use &quot;Listen for Devices&quot; to see already-paired devices, or
            &quot;Start Discovery&quot; to scan for new devices.
          </Text>
        )}

        {/* Web limitations note */}
        <Text
          variant="small"
          color="neutral.c60"
          mt={3}
          style={{ fontStyle: "italic" }}
        >
          Note: &quot;Start Discovery&quot; may not work in web apps due to
          browser security restrictions. WebHID and WebBLE require a user
          gesture (click) in the app context to trigger device discovery.
        </Text>
      </Flex>

      {/* Connected Sessions */}
      {activeDevices.length > 0 && (
        <>
          <Text variant="h4" mb={4}>
            Active Sessions ({activeDevices.length})
          </Text>
          <Flex flexDirection="column" rowGap={3} mb={4}>
            {activeDevices.map((device) => (
              <DeviceCard
                key={device.sessionId}
                device={device}
                state={sessionStates.get(device.sessionId)}
                onDisconnect={() => handleDisconnect(device.sessionId)}
              />
            ))}
          </Flex>
        </>
      )}

      {disconnectedDevices.length > 0 && (
        <>
          <Text variant="h5" mb={3} color="neutral.c70">
            Disconnected Sessions ({disconnectedDevices.length})
          </Text>
          <Flex flexDirection="column" rowGap={3}>
            {disconnectedDevices.map((device) => (
              <DeviceCard
                key={device.sessionId}
                device={device}
                state={sessionStates.get(device.sessionId)}
                onDisconnect={() => handleDisconnect(device.sessionId)}
              />
            ))}
          </Flex>
        </>
      )}

      {devices.length === 0 && !isAnyDiscoveryActive && (
        <Flex
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          flex={1}
          padding={6}
          style={{ opacity: 0.6 }}
        >
          <Text variant="body">No devices connected yet.</Text>
        </Flex>
      )}
    </Flex>
  );
};
