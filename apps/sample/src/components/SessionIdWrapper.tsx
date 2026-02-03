import React from "react";
import { useSelector } from "react-redux";
import { Flex, Icons, Text } from "@ledgerhq/react-ui";

import { selectSelectedSessionId } from "@/state/sessions/selectors";

import { ConnectDeviceButtons } from "./ConnectDevice/ConnectDeviceButtons";

/**
 * Component that wraps the child component and passes it the selected sessionId.
 * If there is no selected sessionId, it renders a message and a button to
 * connect a device.
 */
export const SessionIdWrapper: React.FC<{
  ChildComponent: React.FC<{ sessionId: string }>;
}> = ({ ChildComponent }) => {
  const sessionId = useSelector(selectSelectedSessionId);

  if (!sessionId) {
    return (
      <Flex
        p={6}
        flex={1}
        alignItems="center"
        justifyContent="center"
        flexDirection="column"
        rowGap={6}
        alignSelf="center"
        width={400}
      >
        <Icons.DeleteCircleFill size="XL" color="error.c70" />
        <Text textAlign="center">
          No selected session id, first connect a device.
        </Text>
        <ConnectDeviceButtons />
      </Flex>
    );
  }

  return <ChildComponent key={sessionId} sessionId={sessionId} />;
};
