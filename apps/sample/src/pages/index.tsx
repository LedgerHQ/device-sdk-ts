"use client";
import React from "react";
import { Box } from "@ledgerhq/react-ui/index";
import styled, { DefaultTheme } from "styled-components";

const MainContainer = styled(Box)`
  width: 100%;
  height: 100%;
  background-color: ${({ theme }: { theme: DefaultTheme }) =>
    theme.colors.background.main};
  color: ${({ theme }: { theme: DefaultTheme }) => theme.colors.neutral.c90};
`;

const Home: React.FC = () => {
  return <MainContainer>Test</MainContainer>;
};

export default Home;
