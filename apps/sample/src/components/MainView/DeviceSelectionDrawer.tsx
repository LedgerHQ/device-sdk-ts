import { StyledDrawer } from "@/components/StyledDrawer";
import React from "react";
import { Text } from "@ledgerhq/react-ui";
import { ConnectDeviceActions } from "@/components/MainView/ConnectDeviceActions";
import { SdkError } from "@ledgerhq/device-management-kit";
import { useDeviceSessionsContext } from "@/providers/DeviceSessionsProvider";
import { Device } from "@/components/Device";

export const DeviceSelectionDrawer: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onError: (error: SdkError | null) => void;
}> = ({ isOpen, onClose, onError }) => {
  const {
    state: { deviceById },
  } = useDeviceSessionsContext();
  return (
    <StyledDrawer isOpen={isOpen} onClose={onClose} big title="Select a device">
      <Text variant="body" fontWeight="regular" color="opacityDefault.c60">
        Connect another device
      </Text>
      <ConnectDeviceActions onError={onError} />
      <Text
        variant="body"
        fontWeight="regular"
        color="opacityDefault.c60"
        mt={5}
      >
        Available devices
      </Text>
      <div data-testid="container_devices">
        {Object.entries(deviceById).map(([sessionId, device]) => (
          <Device
            key={sessionId}
            sessionId={sessionId}
            name={device.name}
            model={device.modelId}
            type={device.type}
            showActiveIndicator
          />
        ))}
      </div>
    </StyledDrawer>
  );
};
