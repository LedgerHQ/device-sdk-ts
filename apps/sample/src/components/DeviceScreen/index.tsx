/**
 * src/components/DeviceScreen/index.tsx
 *
 * Live device screen, docked in the sidebar next to the device sessions it
 * belongs to. Rendered only while a device is connected, sticks to the top of
 * the sidebar while the menu scrolls under it, and collapses to its header row.
 */
"use client";

import React, { useCallback, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  DeviceScreen as Screen,
  findDeviceScreenModel,
  mockServerScreenApi,
  useMockServerDevice,
} from "@ledgerhq/device-mockserver-react";
import { ThemeProvider } from "@ledgerhq/lumen-ui-react";
import { Flex, Icons, Text } from "@ledgerhq/react-ui";
import styled, { type DefaultTheme } from "styled-components";

import { DEVICE_SCREEN_ICON } from "@/components/DeviceScreen/deviceModel";
import { useSpeculosScreenApi } from "@/components/DeviceScreen/useSpeculosScreenApi";
import { useMockClient } from "@/hooks/useMockClient";
import {
  selectOrderedConnectedDevices,
  selectSelectedSessionId,
} from "@/state/sessions/selectors";
import {
  selectDeviceScreenCollapsed,
  selectMockServerSessionToken,
  selectMockServerUrl,
  selectTransportType,
} from "@/state/settings/selectors";
import { setDeviceScreenCollapsed } from "@/state/settings/slice";

const Root = styled(Flex).attrs({ borderRadius: 2 })`
  position: sticky;
  top: 0;
  z-index: 1;
  flex-direction: column;
  background-color: ${({ theme }: { theme: DefaultTheme }) =>
    theme.colors.neutral.c30};
`;

const Header = styled(Flex).attrs({ px: 4, py: 3 })`
  align-items: center;
  column-gap: 8px;
  cursor: pointer;
  user-select: none;
`;

const Title = styled(Text).attrs({ variant: "tiny" })`
  flex: 1;
  color: ${({ theme }: { theme: DefaultTheme }) => theme.colors.neutral.c80};
`;

// Lumen expects Tailwind's preflight, which the sample does not load.
const Body = styled.div`
  margin: 0 12px 12px;

  & * {
    box-sizing: border-box;
  }
`;

export const DeviceScreen: React.FC = () => {
  const dispatch = useDispatch();
  const collapsed = useSelector(selectDeviceScreenCollapsed);
  const connectedDevices = useSelector(selectOrderedConnectedDevices);
  const selectedSessionId = useSelector(selectSelectedSessionId);
  const transportType = useSelector(selectTransportType);
  const mockServerUrl = useSelector(selectMockServerUrl);
  const mockServerToken = useSelector(selectMockServerSessionToken);
  const speculos = useSpeculosScreenApi();

  const session =
    connectedDevices.find(({ sessionId }) => sessionId === selectedSessionId) ??
    connectedDevices[0];
  const device = session?.connectedDevice;
  const mockClient = useMockClient(mockServerUrl, mockServerToken);
  const mockDeviceId = transportType === "mockserver" ? (device?.id ?? "") : "";
  const mockDevice = useMockServerDevice(mockClient, mockDeviceId);
  const mockServer = useMemo(
    () => mockServerScreenApi(mockClient, mockDeviceId),
    [mockClient, mockDeviceId],
  );

  const toggle = useCallback(() => {
    dispatch(setDeviceScreenCollapsed({ deviceScreenCollapsed: !collapsed }));
  }, [dispatch, collapsed]);

  if (
    !device ||
    (transportType !== "mockserver" && transportType !== "speculos")
  ) {
    return null;
  }

  const { label } = findDeviceScreenModel(device.modelId);
  const ModelIcon = DEVICE_SCREEN_ICON[device.modelId];
  const Chevron = collapsed ? Icons.ChevronDown : Icons.ChevronUp;

  return (
    <Root data-testid="container_sidebar-device-screen">
      <Header onClick={toggle} data-testid="button_toggle-device-screen">
        <ModelIcon size="XS" color="neutral.c80" />
        <Title>
          {mockDevice?.firmware_version
            ? `${label} - ${mockDevice.firmware_version}`
            : label}
        </Title>
        <Chevron size="XS" color="neutral.c80" />
      </Header>

      {!collapsed && (
        <Body>
          <ThemeProvider colorScheme="dark">
            <Screen
              key={transportType}
              api={transportType === "mockserver" ? mockServer : speculos}
              deviceType={device.modelId}
            />
          </ThemeProvider>
        </Body>
      )}
    </Root>
  );
};
