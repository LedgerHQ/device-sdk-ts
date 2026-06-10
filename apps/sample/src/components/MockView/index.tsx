import React, { useCallback, useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import {
  type Device,
  type SessionExport,
} from "@ledgerhq/device-mockserver-client";
import { Button, Flex, Icons, Text } from "@ledgerhq/react-ui";
import styled from "styled-components";

import { AddDeviceDrawer } from "@/components/MockView/AddDeviceDrawer";
import { MockDeviceDrawer } from "@/components/MockView/MockDeviceDrawer";
import { MocksSection } from "@/components/MockView/MocksSection";
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

const DeviceRow = styled(Flex)`
  align-items: center;
  column-gap: 8px;
`;

const DeviceItem = styled(Flex)`
  flex: 1;
  flex-direction: column;
  padding: 12px 16px;
  border-radius: 8px;
  background-color: ${({ theme }) => theme.colors.background.card};
  cursor: pointer;

  &:hover {
    background-color: ${({ theme }) => theme.colors.neutral.c30};
  }
`;

export const MockView: React.FC = () => {
  const [devices, setDevices] = useState<Device[]>([]);

  const [currentDevice, setCurrentDevice] = useState<Device | null>(null);
  const [drawerVisible, setDrawerVisibility] = useState<boolean>(false);
  const [addDeviceVisible, setAddDeviceVisibility] = useState<boolean>(false);
  const [mocksReloadToken, setMocksReloadToken] = useState<number>(0);

  const importInputRef = useRef<HTMLInputElement>(null);

  const mockServerUrl = useSelector(selectMockServerUrl);
  const mockServerSessionToken = useSelector(selectMockServerSessionToken);

  const client = useMockClient(mockServerUrl, mockServerSessionToken);

  const fetchDevices = useCallback(async () => {
    try {
      const response = await client.listDevices();
      setDevices(response);
      setCurrentDevice((current) =>
        current
          ? (response.find((device) => device.id === current.id) ?? null)
          : null,
      );
    } catch (error) {
      console.error(error);
    }
  }, [client]);

  const handleDeviceClick = useCallback((device: Device) => {
    setCurrentDevice(device);
    setDrawerVisibility(true);
  }, []);

  const handleDeleteDevice = useCallback(
    async (deviceId: string) => {
      try {
        await client.deleteDevice(deviceId);
        await fetchDevices();
      } catch (error) {
        console.error(error);
      }
    },
    [client, fetchDevices],
  );

  const handleResetSession = useCallback(async () => {
    try {
      const currentDevices = await client.listDevices();
      await Promise.all(
        currentDevices.map((device) => client.deleteDevice(device.id)),
      );
      await client.clearMocks();
      await fetchDevices();
      setMocksReloadToken((token) => token + 1);
    } catch (error) {
      console.error(error);
    }
  }, [client, fetchDevices]);

  const handleExport = useCallback(async () => {
    try {
      const snapshot = await client.exportSession();
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "mock-session.json";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
    }
  }, [client]);

  const handleImportFile = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      try {
        const snapshot = JSON.parse(await file.text()) as SessionExport;
        await client.importSession(snapshot);
        await fetchDevices();
        setMocksReloadToken((token) => token + 1);
      } catch (error) {
        console.error(error);
      }
    },
    [client, fetchDevices],
  );

  useEffect(() => {
    fetchDevices().catch(console.error);
  }, [fetchDevices]);

  return (
    <PageWithHeader title="Mock server">
      <Flex flexDirection="column" flex={2} rowGap={5}>
        <Flex flexDirection="row" flexWrap="wrap" rowGap={3}>
          <MockButton onClick={() => setAddDeviceVisibility(true)}>
            <Text color="neutral.c00">Add device</Text>
          </MockButton>
          <MockButton onClick={handleResetSession}>
            <Text color="neutral.c00">Reset session</Text>
          </MockButton>
          <MockButton onClick={handleExport}>
            <Text color="neutral.c00">Export</Text>
          </MockButton>
          <MockButton onClick={() => importInputRef.current?.click()}>
            <Text color="neutral.c00">Import</Text>
          </MockButton>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json"
            style={{ display: "none" }}
            onChange={handleImportFile}
          />
        </Flex>

        <Text variant="h5">Devices</Text>
        <div style={{ maxHeight: 360, overflow: "scroll" }}>
          {devices.length === 0 ? (
            <Text variant="body" color="neutral.c70">
              No device. Use &quot;Add device&quot; or &quot;Import&quot; to
              create one.
            </Text>
          ) : (
            devices.map((device) => (
              <DeviceRow key={device.id} my={2}>
                <DeviceItem onClick={() => handleDeviceClick(device)}>
                  <Text variant="large" fontWeight="semiBold">
                    {device.name}
                  </Text>
                  <Text variant="body" color="neutral.c70">
                    {`${device.connectivity_type} · ${
                      device.connected ? "connected" : "disconnected"
                    }`}
                  </Text>
                </DeviceItem>
                <Button
                  variant="shade"
                  outline
                  iconButton
                  Icon={() => <Icons.Trash />}
                  onClick={() => handleDeleteDevice(device.id)}
                />
              </DeviceRow>
            ))
          )}
        </div>

        <MocksSection client={client} reloadToken={mocksReloadToken} />
      </Flex>

      <AddDeviceDrawer
        isOpen={addDeviceVisible}
        onClose={() => setAddDeviceVisibility(false)}
        onDeviceAdded={fetchDevices}
        client={client}
      />

      <MockDeviceDrawer
        isOpen={drawerVisible}
        onClose={() => setDrawerVisibility(false)}
        onDeviceChanged={fetchDevices}
        currentDevice={currentDevice}
        client={client}
      />
    </PageWithHeader>
  );
};
