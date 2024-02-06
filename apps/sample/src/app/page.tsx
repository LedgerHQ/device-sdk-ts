"use client";
import { Flex } from "@ledgerhq/react-ui";
import React from "react";
import styled, { DefaultTheme } from "styled-components";

import { MainView } from "@/components/MainView";
import { Sidebar } from "@/components/Sidebar";

const Root = styled(Flex)`
  color: ${({ theme }: { theme: DefaultTheme }) => theme.colors.neutral.c90};
  flex-direction: row;
  height: 100%;
`;

const Home: React.FC = () => {
  return (
    <Root>
      <Sidebar />
      <MainView />
    </Root>
  );
};

export default Home;
