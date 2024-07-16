import React from "react";
import {
  ConnectionType,
  DeviceModelId,
  DeviceSessionId,
} from "@ledgerhq/device-sdk-core";
import { Box, DropdownGeneric, Flex, Icons, Text } from "@ledgerhq/react-ui";
import styled, { DefaultTheme } from "styled-components";

import { useDeviceSessionState } from "@/hooks/useDeviceSessionState";

import { StatusText } from "./StatusText";
import { useDeviceSessionsContext } from "@/providers/DeviceSessionsProvider";

const Root = styled(Flex).attrs({ p: 5, mb: 8, borderRadius: 2 })`
  background: ${({ theme }: { theme: DefaultTheme }) =>
    theme.colors.neutral.c30};
  align-items: center;
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
  onDisconnect: () => Promise<void>;
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
  onDisconnect,
  sessionId,
}) => {
  const sessionState = useDeviceSessionState(sessionId);
  const {
    state: { deviceById, selectedId },
    dispatch,
  } = useDeviceSessionsContext();
  const IconComponent = getIconComponent(model);
  return (
    <Root>
      <IconContainer>
        <IconComponent size="S" />
      </IconContainer>
      <Box flex={1}>
        <Text variant="body">{name}</Text>
        <Flex>
          {sessionState && (
            <>
              <StatusText state={sessionState.deviceStatus}>
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
      <DropdownGeneric closeOnClickOutside label="" placement="bottom">
        {Object.values(deviceById).length > 1 && selectedId !== sessionId && (
          <ActionRow
            onClick={() =>
              dispatch({ type: "select_session", payload: { sessionId } })
            }
          >
            <Text variant="paragraph" color="neutral.c80">
              Select
            </Text>
          </ActionRow>
        )}
        <ActionRow onClick={onDisconnect}>
          <Text variant="paragraph" color="neutral.c80">
            Disconnect
          </Text>
          <Icons.ChevronRight size="S" />
        </ActionRow>
      </DropdownGeneric>
    </Root>
  );
};
