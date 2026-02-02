import React from "react";
import { type DmkError } from "@ledgerhq/device-management-kit";
import { Button, Flex } from "@ledgerhq/react-ui";

import { useConnectDevice } from "@/hooks/useConnectDevice";

type ConnectDeviceActionsProps = {
  onError: (error: DmkError | null) => void;
};

export const ConnectDeviceActions = ({
  onError,
}: ConnectDeviceActionsProps) => {
  const { transportOptions, connectWithTransport } = useConnectDevice({
    onError,
  });

  return (
    <Flex flexDirection="row" columnGap={6}>
      {transportOptions.map((option) => (
        <Button
          key={option.identifier}
          onClick={() => connectWithTransport(option.identifier)}
          variant="main"
          backgroundColor="main"
          size="large"
          data-testid={`CTA_select-device-${option.identifier}`}
        >
          {option.label}
        </Button>
      ))}
    </Flex>
  );
};
