import React from "react";
import { Flex, Text } from "@ledgerhq/react-ui";
import styled, { type DefaultTheme } from "styled-components";

const Container = styled(Flex)`
  flex-direction: column;
  border-radius: 8px;
  padding: 16px 0px;
  gap: 12px;
`;

const Title = styled(Text).attrs({
  variant: "small",
  fontWeight: "semiBold",
})`
  color: ${({ theme }: { theme: DefaultTheme }) => theme.colors.neutral.c70};
`;

type SettingBoxProps = {
  title: string;
  children: React.ReactNode;
};

export const SettingBox: React.FC<SettingBoxProps> = ({ title, children }) => {
  return (
    <Container>
      <Title>{title}</Title>
      {children}
    </Container>
  );
};
