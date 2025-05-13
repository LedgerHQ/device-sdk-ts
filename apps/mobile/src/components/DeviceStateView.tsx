import React from "react";
import { useDeviceSessionState } from "_hooks/useDeviceSessionState";
import useThrottle from "_hooks/useThrottle";
import { Text } from "@ledgerhq/native-ui";

export const DeviceStateView: React.FC<{ sessionId: string }> = ({
  sessionId,
}) => {
  const state = useDeviceSessionState(sessionId);
  const throttledState = useThrottle(state);

  return (
    <Text fontWeight="semiBold">
      Device state: {throttledState?.deviceStatus}
    </Text>
  );
};
