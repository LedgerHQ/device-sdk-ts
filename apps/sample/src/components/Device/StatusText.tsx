import { DeviceStatus } from "@ledgerhq/device-sdk-core";
import { Text } from "@ledgerhq/react-ui";
import styled, { DefaultTheme } from "styled-components";

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
  }
};

type StatusTextProps = {
  readonly state: DeviceStatus;
};

export const StatusText = styled(Text)<StatusTextProps>`
  color: ${(props) => getColorFromState(props)};
`;
