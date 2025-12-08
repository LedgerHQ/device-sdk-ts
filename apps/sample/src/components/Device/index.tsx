import React, { useCallback } from "react";
import { useSelector } from "react-redux";
import {
  type ConnectionType,
  DeviceModelId,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";
import {
  Box,
  Button,
  DropdownGeneric,
  Flex,
  Icons,
  Text,
} from "@ledgerhq/react-ui";
import styled, { type DefaultTheme } from "styled-components";

import { useDeviceSessionState } from "@/hooks/useDeviceSessionState";
import { selectSelectedSessionId } from "@/state/sessions/selectors";

import { StatusText } from "./StatusText";

const Root = styled(Flex).attrs({ p: 5, mb: 8, borderRadius: 2 })`
  background: ${({ theme }: { theme: DefaultTheme }) =>
    theme.colors.neutral.c30};
  align-items: center;
  border: ${({ active, theme }: { theme: DefaultTheme; active: boolean }) =>
    `1px solid ${active ? theme.colors.success.c40 : "transparent"}`};
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
  onDisconnect: (sessionId: DeviceSessionId) => void;
  onReconnect: (sessionId: DeviceSessionId) => void;
  onSelect: (sessionId: DeviceSessionId) => void;
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

const DotText = styled(Text).attrs({ mx: 3, color: "neutral.c50" })``;

export const Device: React.FC<DeviceProps> = ({
  name,
  type,
  model,
  onDisconnect,
  onReconnect,
  onSelect,
  sessionId,
}) => {
  const sessionState = useDeviceSessionState(sessionId);
  const selectedSessionId = useSelector(selectSelectedSessionId);
  const IconComponent = getIconComponent(model);
  const isActive = selectedSessionId === sessionId;

  const handleSelect = useCallback(() => {
    onSelect(sessionId);
  }, [onSelect, sessionId]);

  const handleDisconnect = useCallback(() => {
    onDisconnect(sessionId);
  }, [onDisconnect, sessionId]);

  const handleReconnect = useCallback(() => {
    onReconnect(sessionId);
  }, [onReconnect, sessionId]);

  return (
    <Root active={isActive} onClick={isActive ? undefined : handleSelect}>
      <IconContainer>
        <IconComponent size="S" />
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
              <DotText>•</DotText>
            </>
          )}
          <Text variant="paragraph" color="neutral.c80">
            {type}
          </Text>
        </Flex>
      </Box>
      <div data-testid="dropdown_device-option">
        <DropdownGeneric closeOnClickOutside label="" placement="bottom">
          <ActionRow
            data-testid="CTA_disconnect-device"
            onClick={handleDisconnect}
          >
            <Text variant="paragraph" color="neutral.c80">
              Disconnect
            </Text>
            <Icons.ChevronRight size="S" />
          </ActionRow>
          <ActionRow
            data-testid="CTA_reconnect-device"
            onClick={handleReconnect}
          >
            <Text variant="paragraph" color="neutral.c80">
              Reconnect
            </Text>
            <Icons.ChevronRight size="S" />
          </ActionRow>
        </DropdownGeneric>
      </div>
    </Root>
  );
};

type AvailableDeviceProps = {
  model: DeviceModelId;
  name: string;
  type: ConnectionType;
  connected: boolean;
  onConnect: () => void;
};

export const AvailableDevice: React.FC<AvailableDeviceProps> = ({
  model,
  name,
  type,
  onConnect,
  connected,
}) => {
  const IconComponent = getIconComponent(model);
  return (
    <Root flex={1} mb={0} m={0} active={false}>
      <IconContainer>
        <IconComponent size="S" />
      </IconContainer>
      <Flex flexDirection="column" flex={1} rowGap={2}>
        <Text variant="body">{name}</Text>
        <Flex>
          <Text variant="paragraph" color="neutral.c80">
            {type}
          </Text>
        </Flex>
      </Flex>
      <Button
        size="small"
        variant="shade"
        disabled={connected}
        onClick={onConnect}
      >
        Connect
      </Button>
    </Root>
  );
};
