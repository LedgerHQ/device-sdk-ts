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
import { ChevronDown, ChevronUp } from "@ledgerhq/lumen-ui-react/symbols";

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
  const Chevron = collapsed ? ChevronDown : ChevronUp;

  return (
    <div
      className="sticky top-0 z-[1] flex flex-col rounded-md bg-muted"
      data-testid="container_sidebar-device-screen"
    >
      <div
        className="flex cursor-pointer items-center gap-8 px-16 py-12 select-none"
        onClick={toggle}
        data-testid="button_toggle-device-screen"
      >
        <ModelIcon size={12} className="text-muted" />
        <span className="body-3 flex-1 text-muted">
          {mockDevice?.firmware_version
            ? `${label} - ${mockDevice.firmware_version}`
            : label}
        </span>
        <Chevron size={12} className="text-muted" />
      </div>

      {!collapsed && (
        // Lumen expects Tailwind's preflight, which the sample does not load.
        <div className="mx-12 mb-12 [&_*]:box-border">
          <ThemeProvider colorScheme="dark">
            <Screen
              key={transportType}
              api={transportType === "mockserver" ? mockServer : speculos}
              deviceType={device.modelId}
            />
          </ThemeProvider>
        </div>
      )}
    </div>
  );
};
