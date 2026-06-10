import React, { useCallback, useState } from "react";
import { type MockClient } from "@ledgerhq/device-mockserver-client";
import { Button, Flex, Text } from "@ledgerhq/react-ui";
import styled from "styled-components";

import {
  DeviceForm,
  type DeviceFormValues,
} from "@/components/MockView/DeviceForm";
import { StyledDrawer } from "@/components/StyledDrawer";

type AddDeviceDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  onDeviceAdded: () => void;
  client: MockClient;
};

const MockButton = styled(Button).attrs({
  variant: "main",
  color: "neutral.c00",
  mx: 5,
})``;

const defaultValues: DeviceFormValues = {
  name: "Ledger Nano X",
  deviceType: "nanoX",
  connectivityType: "USB",
  firmwareVersion: "2.2.3",
};

export const AddDeviceDrawer: React.FC<AddDeviceDrawerProps> = ({
  isOpen,
  onClose,
  onDeviceAdded,
  client,
}) => {
  const [values, setValues] = useState<DeviceFormValues>(defaultValues);

  const handleAdd = useCallback(async () => {
    try {
      await client.addDevice({
        name: values.name,
        device_type: values.deviceType,
        connectivity_type: values.connectivityType,
        firmware_version: values.firmwareVersion || undefined,
      });
      onDeviceAdded();
      onClose();
    } catch (error) {
      console.error(error);
    }
  }, [client, values, onDeviceAdded, onClose]);

  return (
    <StyledDrawer isOpen={isOpen} onClose={onClose} big title="Add a device">
      <Flex flexDirection="column" flex={1} justifyContent="space-between">
        <DeviceForm values={values} onChange={setValues} />
        <Flex alignSelf="flex-end">
          <MockButton
            onClick={handleAdd}
            disabled={!values.name || !values.deviceType}
          >
            <Text color="neutral.c00">Add device</Text>
          </MockButton>
        </Flex>
      </Flex>
    </StyledDrawer>
  );
};
