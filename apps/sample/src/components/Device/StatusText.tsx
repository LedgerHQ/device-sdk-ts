import { DeviceStatus } from "@ledgerhq/device-management-kit";
import { Text } from "@ledgerhq/react-ui";
import styled, { type DefaultTheme } from "styled-components";

const getColorFromState = ({
  state,
  theme,
}: {
  state: DeviceStatus;
  theme: DefaultTheme;
}) => {
  switch (state) {
    case DeviceStatus.CONNECTED:
      return theme.colors.success.c50;
    case DeviceStatus.BUSY:
    case DeviceStatus.LOCKED:
      return theme.colors.warning.c60;
    case DeviceStatus.NOT_CONNECTED:
      return theme.colors.error.c60;
  }
};

type StatusTextProps = {
  readonly state: DeviceStatus;
};

export const StatusText = styled(Text)<StatusTextProps>`
  color: ${(props) => getColorFromState(props)};
`;
