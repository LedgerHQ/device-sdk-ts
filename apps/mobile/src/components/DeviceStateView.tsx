import React from "react";
import { Text } from "@ledgerhq/native-ui";
import { useDeviceSessionState } from "_hooks/useDeviceSessionState";
import useThrottle from "_hooks/useThrottle";

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
