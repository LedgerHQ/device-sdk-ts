import React, { useMemo } from "react";
import {
  type ConnectedDevice,
  type DeviceSessionState,
} from "@ledgerhq/device-management-kit";
import { INSPECTOR_COMMAND_TYPES } from "@ledgerhq/device-management-kit-devtools-core";
import { Flex, Text } from "@ledgerhq/react-ui";

import { NotConnectedMessage } from "../../shared/NotConnectedMessage";
import { DeviceCard } from "./DeviceCard";

type SessionsProps = {
  devices: ConnectedDevice[];
  sessionStates: Map<string, DeviceSessionState>;
  sendMessage: (type: string, payload: string) => void;
  isConnected: boolean;
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
  sendMessage,
  isConnected,
}) => {
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

  if (devices.length === 0) {
    return (
      <Flex
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        flex={1}
        padding={6}
        style={{ opacity: 0.6 }}
      >
        <Text variant="h4">No devices connected</Text>
        <Text variant="body" mt={2}>
          Connect a Ledger device to see it here.
        </Text>
      </Flex>
    );
  }

  return (
    <Flex flexDirection="column" flex={1} padding={4} overflow="auto">
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
    </Flex>
  );
};
