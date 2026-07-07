import React, { useCallback, useEffect, useState } from "react";
import {
  type Device,
  type MockClient,
} from "@ledgerhq/device-mockserver-client";
import { Button, Divider, Flex, Text } from "@ledgerhq/react-ui";
import styled from "styled-components";

import {
  cleanApps,
  DeviceForm,
  type DeviceFormValues,
} from "@/components/MockView/DeviceForm";
import { StyledDrawer } from "@/components/StyledDrawer";

type MockDeviceDrawerProps = {
  currentDevice: Device | null;
  isOpen: boolean;
  onClose: () => void;
  client: MockClient;
  onDeviceChanged: () => void;
};

const MockButton = styled(Button).attrs({
  variant: "main",
  color: "neutral.c00",
  mx: 5,
})``;

const toFormValues = (device: Device): DeviceFormValues => ({
  deviceType: device.device_type,
  connectivityType: device.connectivity_type,
  firmwareVersion: device.firmware_version ?? "",
  apps: device.apps ?? [],
});

export const MockDeviceDrawer: React.FC<MockDeviceDrawerProps> = ({
  currentDevice,
  isOpen,
  onClose,
  client,
  onDeviceChanged,
}) => {
  const [values, setValues] = useState<DeviceFormValues>({
    deviceType: "nanoX",
    connectivityType: "USB",
    firmwareVersion: "",
    apps: [],
  });

  useEffect(() => {
    if (currentDevice) {
      setValues(toFormValues(currentDevice));
    }
  }, [currentDevice]);

  const handleSave = useCallback(async () => {
    if (!currentDevice) return;
    try {
      await client.editDevice(currentDevice.id, {
        device_type: values.deviceType,
        connectivity_type: values.connectivityType,
        firmware_version: values.firmwareVersion || undefined,
        apps: cleanApps(values.apps),
      });
      onDeviceChanged();
    } catch (_) {
      console.error("Failed to save device");
    }
  }, [client, currentDevice, values, onDeviceChanged]);

  const handleRemove = useCallback(async () => {
    if (!currentDevice) return;
    try {
      await client.deleteDevice(currentDevice.id);
      onDeviceChanged();
      onClose();
    } catch (_) {
      console.error("Failed to remove device");
    }
  }, [client, currentDevice, onDeviceChanged, onClose]);

  return (
    <StyledDrawer
      isOpen={isOpen}
      onClose={onClose}
      big
      title={currentDevice?.name || "No device"}
    >
      <Flex flexDirection="column" flex={1} justifyContent="space-between">
        <Flex flexDirection="column" rowGap={5}>
          <DeviceForm values={values} onChange={setValues} />
          <Divider my={2} />
          <Flex flexDirection="row">
            <MockButton onClick={handleSave} disabled={!values.deviceType}>
              <Text color="neutral.c00">Save changes</Text>
            </MockButton>
          </Flex>
        </Flex>
        <Flex alignSelf="flex-end">
          <MockButton onClick={handleRemove}>
            <Text color="neutral.c00">Remove device</Text>
          </MockButton>
        </Flex>
      </Flex>
    </StyledDrawer>
  );
};
