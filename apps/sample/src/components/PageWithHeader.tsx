import { Divider, Flex, Text } from "@ledgerhq/react-ui";
import styled from "styled-components";

import React from "react";

const Root = styled(Flex).attrs({ mx: 15, mt: 10, mb: 5 })`
  flex-direction: column;
  flex: 1;
  justify-content: center;
  align-items: center;
`;

const Container = styled(Flex)`
  height: 100%;
  width: 100%;
  flex-direction: column;
  border-radius: 12px;
`;

const Header = styled(Flex).attrs({ py: 6 })``;

const Title = styled(Text).attrs({
  variant: "h5Inter",
  fontWeight: "semiBold",
  fontSize: 18,
})``;

export const PageWithHeader: React.FC<{
  title: string;
  children: React.ReactNode;
}> = ({ title, children }) => {
  return (
    <Root overflow="hidden">
      <Container>
        <Header>
          <Title>{title}</Title>
        </Header>
        <Divider my={4} />
        {children}
      </Container>
    </Root>
  );
};
