import React, { useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { type Device } from "@ledgerhq/device-mockserver-client";
import { Button, Flex, Text } from "@ledgerhq/react-ui";
import styled from "styled-components";

import { ClickableListItem } from "@/components/ClickableListItem";
import { MockDeviceDrawer } from "@/components/MockView/MockDeviceDrawer";
import { PageWithHeader } from "@/components/PageWithHeader";
import { useMockClient } from "@/hooks/useMockClient";
import {
  selectMockServerSessionToken,
  selectMockServerUrl,
} from "@/state/settings/selectors";

const MockButton = styled(Button).attrs({
  variant: "main",
  color: "neutral.c00",
  mx: 5,
})``;

export const MockView: React.FC = () => {
  const [devices, setDevices] = useState<Device[]>([]);

  const [currentDevice, setCurrentDevice] = useState<Device | null>(null);
  const [drawerVisible, setDrawerVisibility] = useState<boolean>(false);

  const mockServerUrl = useSelector(selectMockServerUrl);
  const mockServerSessionToken = useSelector(selectMockServerSessionToken);

  const client = useMockClient(mockServerUrl, mockServerSessionToken);

  const fetchDevices = useCallback(async () => {
    try {
      const response = await client.listDevices();
      setDevices(response);
      setCurrentDevice(null);
    } catch (error) {
      console.error(error);
    }
  }, [client]);

  const handleDeviceClick = useCallback((device: Device) => {
    setCurrentDevice(device);
    setDrawerVisibility(true);
  }, []);

  const handleRemoveDevicesClick = async () => {
    try {
      const response = await client.disconnectAll();
      if (!response) {
        console.log("Failed to disconnect all devices");
      } else {
        fetchDevices().catch(console.error);
      }
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchDevices().catch(console.error);
  }, [fetchDevices]);

  return (
    <PageWithHeader title="Mock server">
      <Flex flexDirection="column" flex={2} justifyContent="space-between">
        <div style={{ maxHeight: 500, overflow: "scroll" }}>
          {devices.map((device) => (
            <ClickableListItem
              key={device.id}
              title={device.name}
              description={`${device.connectivity_type} · ${
                device.connected ? "connected" : "disconnected"
              }`}
              onClick={() => handleDeviceClick(device)}
              my={2}
            />
          ))}
        </div>
        <Flex alignSelf="flex-end">
          <MockButton onClick={handleRemoveDevicesClick}>
            <Text color="neutral.c00">Remove all devices</Text>
          </MockButton>
        </Flex>
      </Flex>

      <MockDeviceDrawer
        isOpen={drawerVisible}
        onClose={() => setDrawerVisibility(false)}
        onDeviceDeleted={fetchDevices}
        currentDevice={currentDevice}
        client={client}
      />
    </PageWithHeader>
  );
};
