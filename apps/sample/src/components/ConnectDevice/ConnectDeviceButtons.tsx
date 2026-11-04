import React from "react";
import { Button, ThemeProvider } from "@ledgerhq/lumen-ui-react";

import { useConnectDevice } from "@/hooks/useConnectDevice";

export const ConnectDeviceButtons: React.FC = () => {
  const { transportOptions, connectWithTransport } = useConnectDevice();

  return (
    <ThemeProvider colorScheme="dark">
      <div className="flex flex-row gap-x-16">
        {transportOptions.map((option) => (
          <Button
            key={option.identifier}
            onClick={() => connectWithTransport(option.identifier)}
            appearance="base"
            size="lg"
            data-testid={`CTA_select-device-${option.identifier}`}
          >
            {option.label}
          </Button>
        ))}
      </div>
    </ThemeProvider>
  );
};
