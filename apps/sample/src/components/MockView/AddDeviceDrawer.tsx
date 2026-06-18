import React, { useCallback, useState } from "react";
import {
  type Device,
  type MockClient,
} from "@ledgerhq/device-mockserver-client";
import { Button, Flex, Text } from "@ledgerhq/react-ui";
import styled from "styled-components";

import {
  cleanApps,
  DeviceForm,
  type DeviceFormValues,
} from "@/components/MockView/DeviceForm";
import { nextDeviceName } from "@/components/MockView/utils";
import { StyledDrawer } from "@/components/StyledDrawer";

type AddDeviceDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  onDeviceAdded: () => void;
  client: MockClient;
  /** Existing devices, used to auto-generate the new device's name. */
  devices: Device[];
};

const MockButton = styled(Button).attrs({
  variant: "main",
  color: "neutral.c00",
  mx: 5,
})``;

const defaultValues: DeviceFormValues = {
  deviceType: "nanoX",
  connectivityType: "USB",
  firmwareVersion: "2.2.3",
  apps: [],
};

export const AddDeviceDrawer: React.FC<AddDeviceDrawerProps> = ({
  isOpen,
  onClose,
  onDeviceAdded,
  client,
  devices,
}) => {
  const [values, setValues] = useState<DeviceFormValues>(defaultValues);

  const handleAdd = useCallback(async () => {
    try {
      await client.addDevice({
        name: nextDeviceName(
          values.deviceType,
          devices.map((device) => device.name),
        ),
        device_type: values.deviceType,
        connectivity_type: values.connectivityType,
        firmware_version: values.firmwareVersion || undefined,
        apps: cleanApps(values.apps),
      });
      onDeviceAdded();
      onClose();
    } catch (_) {
      console.error("Failed to add device");
    }
  }, [client, values, devices, onDeviceAdded, onClose]);

  return (
    <StyledDrawer isOpen={isOpen} onClose={onClose} big title="Add a device">
      <Flex flexDirection="column" flex={1} justifyContent="space-between">
        <DeviceForm values={values} onChange={setValues} />
        <Flex alignSelf="flex-end">
          <MockButton onClick={handleAdd} disabled={!values.deviceType}>
            <Text color="neutral.c00">Add device</Text>
          </MockButton>
        </Flex>
      </Flex>
    </StyledDrawer>
  );
};
