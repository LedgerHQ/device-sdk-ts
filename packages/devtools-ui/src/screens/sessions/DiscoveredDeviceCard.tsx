import React from "react";
import { type DiscoveredDevice } from "@ledgerhq/device-management-kit";
import { Flex, Text } from "@ledgerhq/react-ui";

type DiscoveredDeviceCardProps = {
  device: DiscoveredDevice;
  onConnect: () => void;
};

export const DiscoveredDeviceCard: React.FC<DiscoveredDeviceCardProps> = ({
  device,
  onConnect,
}) => {
  return (
    <Flex
      flexDirection="column"
      padding={4}
      style={{
        border: "1px solid #cce5ff",
        borderRadius: 8,
        background: "#f0f7ff",
      }}
    >
      <Flex justifyContent="space-between" alignItems="center" mb={2}>
        <Flex alignItems="center" columnGap={2}>
          <Text variant="h5">{device.name || "Unknown Device"}</Text>
        </Flex>
        <button
          onClick={onConnect}
          style={{
            background: "#4CAF50",
            color: "white",
            border: "none",
            borderRadius: 4,
            padding: "4px 12px",
            cursor: "pointer",
          }}
        >
          Connect
        </button>
      </Flex>

      <Flex flexDirection="column" rowGap={1}>
        <Text variant="small" color="neutral.c70">
          ID: {device.id}
        </Text>
        <Text variant="small" color="neutral.c70">
          Model: {device.deviceModel.model}
        </Text>
        <Text variant="small" color="neutral.c70">
          Transport: {device.transport}
        </Text>
        {device.rssi !== undefined && device.rssi !== null && (
          <Text variant="small" color="neutral.c70">
            Signal: {device.rssi} dBm
          </Text>
        )}
      </Flex>
    </Flex>
  );
};
