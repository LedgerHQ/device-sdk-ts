"use client";
import React from "react";
import { Flex } from "@ledgerhq/react-ui";
import styled, { DefaultTheme } from "styled-components";
import { Sidebar } from "@/components/Sidebar";
import { MainView } from "@/components/MainView";

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
