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

const Toolbar = styled(Flex)`
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  column-gap: 10px;
  row-gap: 10px;
`;

const SectionTitle = styled(Text).attrs({ variant: "small" })`
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: ${({ theme }) => theme.colors.neutral.c70};
`;

const DeviceList = styled(Flex)`
  flex-direction: column;
  row-gap: 8px;
  max-height: 360px;
  overflow-y: auto;
`;

const DeviceCard = styled(Flex)<{ selected?: boolean }>`
  flex-direction: row;
  align-items: center;
  column-gap: 14px;
  padding: 12px 16px;
  border-radius: 12px;
  background-color: ${({ theme }) => theme.colors.background.card};
  border: 1px solid
    ${({ theme, selected }) =>
      selected ? theme.colors.primary.c70 : theme.colors.neutral.c30};
  box-shadow: ${({ selected, theme }) =>
    selected ? `0 0 0 1px ${theme.colors.primary.c70}` : "none"};
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease;

  &:hover {
    border-color: ${({ theme }) => theme.colors.neutral.c50};
  }
`;

const IconBadge = styled(Flex)`
  width: 40px;
  height: 40px;
  border-radius: 10px;
  align-items: center;
  justify-content: center;
  background-color: ${({ theme }) => theme.colors.neutral.c30};
  flex-shrink: 0;
`;

const Tag = styled(Text).attrs({ variant: "tiny" })`
  padding: 2px 8px;
  border-radius: 999px;
  background-color: ${({ theme }) => theme.colors.neutral.c30};
  color: ${({ theme }) => theme.colors.neutral.c80};
  letter-spacing: 0.04em;
`;

const StatusDot = styled.span<{ $connected?: boolean }>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: ${({ theme, $connected }) =>
    $connected ? theme.colors.success.c50 : theme.colors.neutral.c50};
`;

/** Icon component for a device type (Nano variants share the Nano icon). */
const deviceTypeIcon = (deviceType: string): typeof Icons.Nano => {
  switch (deviceType.toLowerCase()) {
    case "stax":
      return Icons.Stax;
    case "flex":
      return Icons.Flex;
    case "apex":
      return Icons.Apex;
    case "nanos":
    case "nanosp":
    case "nanox":
      return Icons.Nano;
    default:
      return Icons.Devices;
  }
};

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
    } catch (_) {
      console.error("Failed to fetch devices");
    }
  }, [client]);

  // Selecting a device binds the inline Mocks panel to it.
  const handleSelectDevice = useCallback((device: Device) => {
    setCurrentDevice(device);
  }, []);

  // The edit button opens the device drawer.
  const handleEditDevice = useCallback((device: Device) => {
    setCurrentDevice(device);
    setDrawerVisibility(true);
  }, []);

  const handleDeleteDevice = useCallback(
    async (deviceId: string) => {
      try {
        await client.deleteDevice(deviceId);
        await fetchDevices();
      } catch (_) {
        console.error("Failed to delete device");
      }
    },
    [client, fetchDevices],
  );

  const handleResetSession = useCallback(async () => {
    try {
      const currentDevices = await client.listDevices();
      // Deleting devices removes their (device-scoped) mocks too.
      await Promise.all(
        currentDevices.map((device) => client.deleteDevice(device.id)),
      );
      setCurrentDevice(null);
      await fetchDevices();
      setMocksReloadToken((token) => token + 1);
    } catch (_) {
      console.error("Failed to reset session");
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
    } catch (_) {
      console.error("Failed to export session");
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
      } catch (_) {
        console.error("Failed to import session");
      }
    },
    [client, fetchDevices],
  );

  useEffect(() => {
    fetchDevices().catch(() => console.error("Failed to fetch devices"));
  }, [fetchDevices]);

  return (
    <PageWithHeader title="Mock server">
      <Flex flexDirection="column" flex={2} rowGap={6}>
        <Toolbar>
          <Button
            variant="main"
            Icon={() => <Icons.Plus size="S" />}
            onClick={() => setAddDeviceVisibility(true)}
          >
            Add device
          </Button>
          <Button
            variant="shade"
            outline
            Icon={() => <Icons.Refresh size="S" />}
            onClick={handleResetSession}
          >
            Reset session
          </Button>
          <Button
            variant="shade"
            outline
            Icon={() => <Icons.FileDownload size="S" />}
            onClick={handleExport}
          >
            Export
          </Button>
          <Button
            variant="shade"
            outline
            Icon={() => <Icons.CloudUpload size="S" />}
            onClick={() => importInputRef.current?.click()}
          >
            Import
          </Button>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json"
            style={{ display: "none" }}
            onChange={handleImportFile}
          />
        </Toolbar>

        <Flex flexDirection="column" rowGap={3}>
          <SectionTitle>{`Devices (${devices.length})`}</SectionTitle>
          {devices.length === 0 ? (
            <Text variant="body" color="neutral.c70">
              No device yet. Use &quot;Add device&quot; or &quot;Import&quot; to
              create one.
            </Text>
          ) : (
            <DeviceList>
              {devices.map((device) => {
                const DeviceTypeIcon = deviceTypeIcon(device.device_type);
                const selected = currentDevice?.id === device.id;
                return (
                  <DeviceCard
                    key={device.id}
                    selected={selected}
                    onClick={() => handleSelectDevice(device)}
                  >
                    <IconBadge>
                      <DeviceTypeIcon size="S" />
                    </IconBadge>
                    <Flex flexDirection="column" rowGap={1} flex={1}>
                      <Text variant="large" fontWeight="semiBold">
                        {device.name}
                      </Text>
                      <Flex
                        flexDirection="row"
                        alignItems="center"
                        columnGap={3}
                      >
                        <Tag>{device.connectivity_type}</Tag>
                        <Flex
                          flexDirection="row"
                          alignItems="center"
                          columnGap={2}
                        >
                          <StatusDot $connected={device.connected} />
                          <Text variant="small" color="neutral.c70">
                            {device.connected ? "Connected" : "Disconnected"}
                          </Text>
                        </Flex>
                      </Flex>
                    </Flex>
                    <Flex
                      flexDirection="row"
                      columnGap={2}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        variant="shade"
                        outline
                        iconButton
                        Icon={() => <Icons.PenEdit />}
                        onClick={() => handleEditDevice(device)}
                      />
                      <Button
                        variant="shade"
                        outline
                        iconButton
                        Icon={() => <Icons.Trash />}
                        onClick={() => handleDeleteDevice(device.id)}
                      />
                    </Flex>
                  </DeviceCard>
                );
              })}
            </DeviceList>
          )}
        </Flex>

        <MocksSection
          client={client}
          deviceId={currentDevice?.id ?? null}
          deviceName={currentDevice?.name}
          reloadToken={mocksReloadToken}
        />
      </Flex>

      <AddDeviceDrawer
        isOpen={addDeviceVisible}
        onClose={() => setAddDeviceVisibility(false)}
        onDeviceAdded={fetchDevices}
        client={client}
        devices={devices}
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
