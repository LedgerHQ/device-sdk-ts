import React from "react";
import { Text } from "@ledgerhq/native-ui";
import { useDeviceSessionState } from "_hooks/useDeviceSessionState";
import useDebounce from "_hooks/useDebounce";

export const DeviceStateView: React.FC<{ sessionId: string }> = ({
  sessionId,
}) => {
  const state = useDeviceSessionState(sessionId);
  const debouncedState = useDebounce(state);

  return (
    <Text fontWeight="semiBold">
      Device state: {debouncedState?.deviceStatus}
    </Text>
  );
};
