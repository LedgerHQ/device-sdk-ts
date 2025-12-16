import React from "react";
import { Flex } from "@ledgerhq/react-ui";
import styled from "styled-components";

const Container = styled(Flex)`
  flex-direction: row;
  flex: 1;
`;

export const SettingBox: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  return <Container>{children}</Container>;
};
