import React from "react";
import { Text } from "@ledgerhq/native-ui";
import { useDeviceSessionState } from "_hooks/useDeviceSessionState";

export const DeviceStateView: React.FC<{ sessionId: string }> = ({
  sessionId,
}) => {
  const state = useDeviceSessionState(sessionId);

  return <Text fontWeight="semiBold">Device state: {state?.deviceStatus}</Text>;
};
