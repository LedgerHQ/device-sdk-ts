import React from "react";
import { useColorScheme } from "react-native";
import { useDeviceSessionsContext } from "_providers/deviceSessionsProvider";
import { useMockServer } from "_providers/mockServerProvider";
import { MockServerDevice } from "@ledgerhq/device-mockserver-react-native";
import { mockserverIdentifier } from "@ledgerhq/device-transport-kit-mockserver";

/** Whether a session's device is a mock server one, with a screen to show. */
export const useIsMockServerSession = (sessionId: string | undefined) => {
  const {
    state: { deviceById },
  } = useDeviceSessionsContext();
  return (
    sessionId !== undefined &&
    deviceById[sessionId]?.transport === mockserverIdentifier
  );
};

/**
 * The live screen of the device behind a session, when the mock server serves
 * it. Nothing otherwise: a physical device has its own screen.
 */
export const SessionDeviceScreen: React.FC<{ sessionId: string }> = ({
  sessionId,
}) => {
  const {
    state: { deviceById },
  } = useDeviceSessionsContext();
  const { session } = useMockServer();
  const colorScheme = useColorScheme() === "dark" ? "dark" : "light";
  const device = deviceById[sessionId];

  if (
    device?.transport !== mockserverIdentifier ||
    session.status !== "ready"
  ) {
    return null;
  }

  return (
    <MockServerDevice
      url={session.url}
      token={session.token}
      deviceId={device.id}
      colorScheme={colorScheme}
    />
  );
};
