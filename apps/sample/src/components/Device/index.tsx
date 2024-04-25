import React from "react";
import { ConnectionType, DeviceModelId } from "@ledgerhq/device-sdk-core";
import { Box, DropdownGeneric, Flex, Icons, Text } from "@ledgerhq/react-ui";
import styled, { DefaultTheme } from "styled-components";

import { StatusText } from "./StatusText";

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

export enum DeviceStatus {
  AVAILABLE = "Available",
  CONNECTED = "Connected",
  BUSY = "Busy",
  LOCKED = "Locked",
  NOT_CONNECTED = "Not Connected",
}

// These props are subject to change.
type DeviceProps = {
  name: string;
  type: ConnectionType;
  model: DeviceModelId;
  status?: DeviceStatus;
  onDisconnect: () => Promise<void>;
};

export const Device: React.FC<DeviceProps> = ({
  name,
  status = DeviceStatus.AVAILABLE,
  type,
  model,
  onDisconnect,
}) => {
  return (
    <Root>
      <IconContainer>
        {model === DeviceModelId.STAX ? (
          <Icons.Stax size="S" />
        ) : (
          <Icons.Nano size="S" />
        )}
      </IconContainer>
      <Box flex={1}>
        <Text variant="body">{name}</Text>
        <Flex>
          {status && (
            <>
              <StatusText status={status}>{status}</StatusText>
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
