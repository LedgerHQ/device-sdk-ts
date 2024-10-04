import React from "react";
import { SdkError } from "@ledgerhq/device-management-kit";
import { Text } from "@ledgerhq/react-ui";
import styled from "styled-components";

import { Device } from "@/components/Device";
import { ConnectDeviceActions } from "@/components/MainView/ConnectDeviceActions";
import { StyledDrawer } from "@/components/StyledDrawer";
import { useDeviceSessionsContext } from "@/providers/DeviceSessionsProvider";

const AvailableDevicesText = styled(Text).attrs({
  mt: 5,
  variant: "body",
  fontWeight: "regular",
  color: "opacityDefault.c60",
})``;

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
      <AvailableDevicesText>Available devices</AvailableDevicesText>
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
