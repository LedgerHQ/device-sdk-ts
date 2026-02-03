import React from "react";
import { Button, Flex } from "@ledgerhq/react-ui";

import { useConnectDevice } from "@/hooks/useConnectDevice";

export const ConnectDeviceButtons: React.FC = () => {
  const { transportOptions, connectWithTransport } = useConnectDevice();

  return (
    <Flex flexDirection="row" columnGap={6}>
      {transportOptions.map((option) => (
        <Button
          key={option.identifier}
          onClick={() => connectWithTransport(option.identifier)}
          variant="main"
          size="large"
          data-testid={`CTA_select-device-${option.identifier}`}
        >
          {option.label}
        </Button>
      ))}
    </Flex>
  );
};
