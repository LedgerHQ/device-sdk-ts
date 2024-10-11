import React from "react";
import { Button, Flex, Icons, Text } from "@ledgerhq/react-ui";
import { useRouter } from "next/navigation";

import { useDeviceSessionsContext } from "@/providers/DeviceSessionsProvider";

/**
 * Component that wraps the child component and passes it the selected sessionId.
 * If there is no selected sessionId, it renders a message and a button to go to the home page.
 */
export const SessionIdWrapper: React.FC<{
  ChildComponent: React.FC<{ sessionId: string }>;
}> = ({ ChildComponent }) => {
  const {
    state: { selectedId: sessionId },
  } = useDeviceSessionsContext();

  const router = useRouter();

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
        <Button variant="main" onClick={() => router.replace("/")}>
          Go to the home page
        </Button>
      </Flex>
    );
  }

  return <ChildComponent sessionId={sessionId} />;
};
