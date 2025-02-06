import React from "react";
import { Flex, Text } from "@ledgerhq/native-ui";
import { useDeviceSessionState } from "_hooks/useDeviceSessionState";

export const DeviceStateView: React.FC<{ sessionId: string }> = ({
  sessionId,
}) => {
  const state = useDeviceSessionState(sessionId);

  return (
    <Flex flexDirection="row">
      <Text>Device state: {state?.deviceStatus}</Text>;
    </Flex>
  );
};
