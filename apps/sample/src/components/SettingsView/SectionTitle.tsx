import React from "react";
import { Text } from "@ledgerhq/react-ui";
import styled, { type DefaultTheme } from "styled-components";

const Title = styled(Text).attrs({
  variant: "h3Inter",
  fontWeight: "medium",
})`
  color: ${({ theme }: { theme: DefaultTheme }) => theme.colors.neutral.c100};
`;

type SectionTitleProps = {
  children: React.ReactNode;
};

export const SectionTitle: React.FC<SectionTitleProps> = ({ children }) => {
  return <Title>{children}</Title>;
};
