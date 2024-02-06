import { Text } from "@ledgerhq/react-ui";
import styled, { DefaultTheme } from "styled-components";

import { DeviceStatus } from ".";

const getColorFromState = ({
  status,
  theme,
}: {
  status: DeviceStatus;
  theme: DefaultTheme;
}) => {
  switch (status) {
    case DeviceStatus.CONNNECTED:
      return theme.colors.success.c50;
    case DeviceStatus.AVAILABLE:
      return theme.colors.primary.c80;
    case DeviceStatus.BUSY:
    case DeviceStatus.LOCKED:
      return theme.colors.warning.c60;
    case DeviceStatus.NOT_CONNECTED:
      return theme.colors.neutral.c80;
  }
};

type StatusTextProps = {
  readonly status: DeviceStatus;
};

export const StatusText = styled(Text)<StatusTextProps>`
  color: ${(props) => getColorFromState(props)};
`;
