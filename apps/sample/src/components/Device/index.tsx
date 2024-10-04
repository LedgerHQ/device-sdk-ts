import React, { useCallback } from "react";
import {
  ConnectionType,
  DeviceModelId,
  DeviceSessionId,
} from "@ledgerhq/device-management-kit";
import { Box, DropdownGeneric, Flex, Icons, Text } from "@ledgerhq/react-ui";
import styled, { DefaultTheme } from "styled-components";

import { useDeviceSessionState } from "@/hooks/useDeviceSessionState";

import { StatusText } from "./StatusText";
import { useDeviceSessionsContext } from "@/providers/DeviceSessionsProvider";
import { useSdk } from "@/providers/DeviceSdkProvider";
import { useDeviceSelectionContext } from "@/providers/DeviceSelectionProvider";

const Root = styled(Flex).attrs({ p: 5, mb: 8, borderRadius: 2 })`
  background: ${({ theme }: { theme: DefaultTheme }) =>
    theme.colors.neutral.c30};
  align-items: center;
  border: ${({ active, theme }: { theme: DefaultTheme; active: boolean }) =>
    `1px solid ${active ? theme.colors.opacityDefault.c40 : "transparent"}`};
  cursor: ${({ active }: { active: boolean }) =>
    active ? "normal" : "pointer"};
`;

const IconContainer = styled(Flex).attrs({ p: 4, mr: 3, borderRadius: 100 })`
  background: ${({ theme }: { theme: DefaultTheme }) =>
    theme.colors.neutral.c40};
  justify-content: center;
  align-items: center;
`;

const ActionRow = styled(Flex).attrs({ py: 4, px: 2 })`
  position: relative;
  cursor: pointer;
  flex-direction: row;
  flex: 1;
  min-width: 120px;
  align-items: center;
  justify-content: space-between;
`;

// These props are subject to change.
type DeviceProps = {
  name: string;
  type: ConnectionType;
  sessionId: DeviceSessionId;
  model: DeviceModelId;
  showActiveIndicator?: boolean;
  showSelectDeviceAction?: boolean;
};

function getIconComponent(model: DeviceModelId) {
  switch (model) {
    case DeviceModelId.STAX:
      return Icons.Stax;
    case DeviceModelId.FLEX:
      return Icons.Flex;
    default:
      return Icons.Nano;
  }
}

export const Device: React.FC<DeviceProps> = ({
  name,
  type,
  model,
  sessionId,
  showActiveIndicator,
  showSelectDeviceAction,
}) => {
  const sessionState = useDeviceSessionState(sessionId);
  const {
    state: { selectedId },
    dispatch,
  } = useDeviceSessionsContext();
  const { setVisibility: setDeviceSelectionVisibility } =
    useDeviceSelectionContext();
  const sdk = useSdk();
  const onDisconnect = useCallback(async () => {
    try {
      await sdk.disconnect({ sessionId });
      dispatch({ type: "remove_session", payload: { sessionId } });
    } catch (e) {
      console.error(e);
    }
  }, [dispatch, sdk, sessionId]);
  const onSelect = useCallback(() => {
    dispatch({
      type: "select_session",
      payload: { sessionId },
    });
  }, [sessionId]);
  const IconComponent = getIconComponent(model);
  const isActive = selectedId === sessionId;

  return (
    <Root
      active={showActiveIndicator && isActive}
      onClick={isActive ? undefined : onSelect}
    >
      <IconContainer>
        <IconComponent size="S" color="neutral.c100" />
      </IconContainer>
      <Box flex={1}>
        <Text data-testid="text_device-name" variant="body">
          {name}
        </Text>
        <Flex>
          {sessionState && (
            <>
              <StatusText
                data-testid="text_device-connection-status"
                state={sessionState.deviceStatus}
              >
                {sessionState.deviceStatus}
              </StatusText>
              <Text mx={3} color="neutral.c50">
                •
              </Text>
            </>
          )}
          <Text variant="paragraph" color="neutral.c80">
            {type}
          </Text>
        </Flex>
      </Box>
      <div data-testid="dropdown_device-option">
        <DropdownGeneric closeOnClickOutside label="" placement="bottom">
          {showSelectDeviceAction && (
            <ActionRow
              data-testid="CTA_change-device"
              onClick={() => setDeviceSelectionVisibility(true)}
            >
              <Text variant="paragraph" color="neutral.c80">
                Change device
              </Text>
              <Icons.ChevronRight size="S" />
            </ActionRow>
          )}
          <ActionRow data-testid="CTA_disconnect-device" onClick={onDisconnect}>
            <Text variant="paragraph" color="neutral.c80">
              Disconnect
            </Text>
            <Icons.ChevronRight size="S" />
          </ActionRow>
        </DropdownGeneric>
      </div>
    </Root>
  );
};
