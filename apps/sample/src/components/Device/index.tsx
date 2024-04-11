import React from "react";
import { ConnectionType, DeviceModelId } from "@ledgerhq/device-sdk-core";
import { Box, Flex, Icons, Text } from "@ledgerhq/react-ui";
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

export enum DeviceStatus {
  AVAILABLE = "Available",
  CONNNECTED = "Connected",
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
};

export const Device: React.FC<DeviceProps> = ({
  name,
  status = DeviceStatus.AVAILABLE,
  type,
  model,
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
              <StatusText variant="paragraph" status={status}>
                {status}
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
      {!status ? <Icons.ChevronRight /> : <Icons.MoreVertical />}
    </Root>
  );
};
