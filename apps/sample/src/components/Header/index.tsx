import React from "react";
import { Flex, Icons } from "@ledgerhq/react-ui";
import styled, { DefaultTheme } from "styled-components";

const Root = styled(Flex).attrs({ py: 3, px: 10, gridGap: 8 })`
  color: ${({ theme }: { theme: DefaultTheme }) => theme.colors.neutral.c90};
  justify-content: flex-end;
  align-items: center;
`;

const Actions = styled(Flex)`
  justify-content: flex-end;
  align-items: center;
  flex: 1 0 0;
`;
const IconBox = styled(Flex).attrs({ p: 3 })`
  cursor: pointer;
  align-items: center;
  opacity: 0.7;
`;

export const Header = () => (
  <Root>
    <Actions>
      <IconBox>
        <Icons.Question size={"M"} />
      </IconBox>
      <IconBox>
        <Icons.Settings size={"M"} />
      </IconBox>
    </Actions>
  </Root>
);
