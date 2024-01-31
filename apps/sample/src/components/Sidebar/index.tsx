import React from "react";
import { Box, Flex, Icons, Text } from "@ledgerhq/react-ui";
import styled, { DefaultTheme } from "styled-components";
import { Menu } from "../Menu";
import { Device } from "../Device";

const Root = styled(Flex).attrs({ py: 8, px: 6 })`
  flex-direction: column;
  width: 280px;
  background-color: ${({ theme }: { theme: DefaultTheme }) =>
    theme.colors.background.main};
`;

const Title = styled(Text).attrs({ mb: 8 })`
  opacity: 0.5;
`;

const Subtitle = styled(Text).attrs({ mb: 5 })``;

const MenuContainer = styled(Box)`
  flex: 1;
  opacity: 0.2;
`;

const BottomContainer = styled(Flex)`
  opacity: 0.2;
  flex-direction: column;
  align-items: center;
`;

const LogsContainer = styled(Flex).attrs({ mb: 6 })`
  flex-direction: row;
  align-items: center;
`;

const LogsText = styled(Text).attrs({ ml: 3 })``;

const VersionText = styled(Text)`
  color: ${({ theme }: { theme: DefaultTheme }) => theme.colors.neutral.c50};
`;

export const Sidebar: React.FC = () => {
  return (
    <Root>
      <Title variant={"large"}>Ledger Device SDK</Title>

      <Subtitle variant={"tiny"}>Device</Subtitle>
      <Device />

      <MenuContainer>
        <Subtitle variant={"tiny"}>Menu</Subtitle>
        <Menu />
      </MenuContainer>

      <BottomContainer>
        <LogsContainer>
          <Icons.ExternalLink />
          <LogsText variant={"paragraph"}>Share logs</LogsText>
        </LogsContainer>
        <VersionText variant={"body"}>
          Ledger device SDK version 0.0.1
        </VersionText>
        <VersionText variant={"body"}>App version 0.1</VersionText>
      </BottomContainer>
    </Root>
  );
};
