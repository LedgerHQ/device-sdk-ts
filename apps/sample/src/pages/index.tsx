"use client";
import React from "react";
import { Box } from "@ledgerhq/react-ui/index";
import styled from "styled-components";

const MainContainer = styled(Box)`
  width: 100%;
  height: 100%;
  background-color: ${({ theme }) => theme.colors.background.main};
  color: ${({ theme }) => theme.colors.neutral.c90};
`;

const Home: React.FC = () => {
  return <MainContainer>Test</MainContainer>;
};

export default Home;
