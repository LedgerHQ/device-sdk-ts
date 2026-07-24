import React from "react";
import { Button } from "@ledgerhq/lumen-ui-react";
import { Flex } from "@ledgerhq/react-ui";

import { useConnectDevice } from "@/hooks/useConnectDevice";

export const ConnectDeviceButtons: React.FC = () => {
  const { transportOptions, connectWithTransport } = useConnectDevice();

  // The `dark` class scopes Lumen's dark-mode design tokens to these buttons,
  // matching the rest of the (react-ui dark themed) app.
  return (
    <div className="dark">
      <Flex flexDirection="row" columnGap={6}>
        {transportOptions.map((option) => (
          <Button
            key={option.identifier}
            appearance="base"
            size="lg"
            onClick={() => connectWithTransport(option.identifier)}
            data-testid={`CTA_select-device-${option.identifier}`}
          >
            {option.label}
          </Button>
        ))}
      </Flex>
    </div>
  );
};
