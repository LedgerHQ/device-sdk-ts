import React from "react";
import { Box } from "@ledgerhq/react-ui";
import styled, { DefaultTheme } from "styled-components";

const Root = styled(Box).attrs({ p: 6, mb: 8, borderRadius: 2 })`
  background: ${({ theme }: { theme: DefaultTheme }) =>
    theme.colors.neutral.c30};
`;

export const Device: React.FC = () => {
  return <Root>No device connected</Root>;
};
