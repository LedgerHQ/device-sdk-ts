/**
 * src/components/DeviceScreen/index.tsx
 *
 * Live device screen, docked in the sidebar next to the device sessions it
 * belongs to. Rendered only while a device is connected, sticks to the top of
 * the sidebar while the menu scrolls under it, and collapses to its header row.
 *
 * What fills it is decided by useDeviceScreenSource, not here.
 */
"use client";

import React, { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Flex, Icons, Text } from "@ledgerhq/react-ui";
import styled, { type DefaultTheme } from "styled-components";

import {
  DEVICE_SCREEN,
  type DeviceScreenModel,
} from "@/components/DeviceScreen/deviceModel";
import { DeviceOsInfo } from "@/components/DeviceScreen/DeviceOsInfo";
import { DeviceScreenButtons } from "@/components/DeviceScreen/DeviceScreenButtons";
import { DeviceScreenImage } from "@/components/DeviceScreen/DeviceScreenImage";
import { type DeviceScreenState } from "@/components/DeviceScreen/sources/types";
import { useDeviceScreenSource } from "@/components/DeviceScreen/sources/useDeviceScreenSource";
import {
  selectOrderedConnectedDevices,
  selectSelectedSessionId,
} from "@/state/sessions/selectors";
import { selectDeviceScreenCollapsed } from "@/state/settings/selectors";
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

const Body = styled(Flex)`
  flex-direction: column;
  row-gap: 8px;
  margin: 0 12px 12px;
`;

const Status = styled(Text).attrs({ variant: "tiny" })`
  color: ${({ theme }: { theme: DefaultTheme }) => theme.colors.neutral.c60};
`;

const ErrorStatus = styled(Status)`
  color: ${({ theme }: { theme: DefaultTheme }) => theme.colors.error.c60};
  word-break: break-word;
`;

export const DeviceScreen: React.FC = () => {
  const dispatch = useDispatch();
  const collapsed = useSelector(selectDeviceScreenCollapsed);
  const connectedDevices = useSelector(selectOrderedConnectedDevices);
  const selectedSessionId = useSelector(selectSelectedSessionId);

  const session =
    connectedDevices.find(({ sessionId }) => sessionId === selectedSessionId) ??
    connectedDevices[0];
  const device = session?.connectedDevice;

  const state = useDeviceScreenSource(device?.id ?? "", !!device && !collapsed);

  const toggle = useCallback(() => {
    dispatch(setDeviceScreenCollapsed({ deviceScreenCollapsed: !collapsed }));
  }, [dispatch, collapsed]);

  if (!device || state.kind === "unavailable") {
    return null;
  }

  const model = DEVICE_SCREEN[device.modelId];
  const Chevron = collapsed ? Icons.ChevronDown : Icons.ChevronUp;

  return (
    <Root data-testid="container_device-screen">
      <Header onClick={toggle} data-testid="button_toggle-device-screen">
        <model.Icon size="XS" color="neutral.c80" />
        <Title>{model.label} screen</Title>
        <Chevron size="XS" color="neutral.c80" />
      </Header>

      {!collapsed && <Body>{renderScreen(state, model)}</Body>}
    </Root>
  );
};

function renderScreen(state: DeviceScreenState, model: DeviceScreenModel) {
  switch (state.kind) {
    case "loading":
      return <Status>Loading…</Status>;
    case "error":
      return <ErrorStatus>{state.message}</ErrorStatus>;
    case "os-info":
      return <DeviceOsInfo device={state.device} />;
    case "image":
      return (
        <>
          <DeviceScreenImage
            src={state.src}
            onTouch={model.touch ? state.input.touch : undefined}
          />
          {model.buttons && (
            <DeviceScreenButtons onPress={state.input.pressButton} />
          )}
        </>
      );
    default:
      return null;
  }
}
