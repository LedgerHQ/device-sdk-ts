import React from "react";
import {
  type ConnectedDevice,
  type DeviceSessionState,
} from "@ledgerhq/device-management-kit";
import { Flex, Text } from "@ledgerhq/react-ui";

type DeviceCardProps = {
  device: ConnectedDevice;
  state?: DeviceSessionState;
  onDisconnect: () => void;
};

const isConnected = (state?: DeviceSessionState): boolean => {
  if (!state) return true; // Assume connected if no state yet
  return state.deviceStatus !== "NOT CONNECTED";
};

export const DeviceCard: React.FC<DeviceCardProps> = ({
  device,
  state,
  onDisconnect,
}) => {
  const connected = isConnected(state);

  return (
    <Flex
      flexDirection="column"
      padding={4}
      style={{
        border: "1px solid #ddd",
        borderRadius: 8,
        background: connected ? "#fafafa" : "#f0f0f0",
        opacity: connected ? 1 : 0.6,
      }}
    >
      <Flex justifyContent="space-between" alignItems="center" mb={2}>
        <Flex alignItems="center" columnGap={2}>
          <Text variant="h5">{device.name || "Unknown Device"}</Text>
          {!connected && (
            <Text variant="small" color="neutral.c60">
              (disconnected)
            </Text>
          )}
        </Flex>
        {connected && (
          <button
            onClick={onDisconnect}
            style={{
              background: "#ff4444",
              color: "white",
              border: "none",
              borderRadius: 4,
              padding: "4px 12px",
              cursor: "pointer",
            }}
          >
            Disconnect
          </button>
        )}
      </Flex>

      <Flex flexDirection="column" rowGap={1}>
        <Text variant="small" color="neutral.c70">
          Session ID: {device.sessionId}
        </Text>
        <Text variant="small" color="neutral.c70">
          Model: {device.modelId}
        </Text>
        <Text variant="small" color="neutral.c70">
          Transport: {device.transport}
        </Text>
        <Text variant="small" color="neutral.c70">
          Type: {device.type}
        </Text>
      </Flex>

      {state && (
        <Flex
          flexDirection="column"
          mt={3}
          pt={3}
          style={{ borderTop: "1px solid #eee" }}
        >
          <Text variant="small" fontWeight="600" mb={1}>
            Session State
          </Text>
          <Text variant="small" color="neutral.c70">
            Status: {state.deviceStatus}
          </Text>
          <Text variant="small" color="neutral.c70">
            State Type: {state.sessionStateType}
          </Text>
          {"currentApp" in state && state.currentApp && (
            <Text variant="small" color="neutral.c70">
              Current App: {state.currentApp.name} v{state.currentApp.version}
            </Text>
          )}
          {"firmwareVersion" in state && state.firmwareVersion && (
            <Text variant="small" color="neutral.c70">
              Firmware: {state.firmwareVersion.os}
            </Text>
          )}
        </Flex>
      )}
    </Flex>
  );
};
