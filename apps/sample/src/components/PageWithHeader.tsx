import React from "react";
import { Breadcrumb, Divider, Flex } from "@ledgerhq/react-ui";
import { Props as BreadCrumbProps } from "@ledgerhq/react-ui/components/navigation/Breadcrumb/index";
import styled from "styled-components";

const Root = styled(Flex).attrs({ mx: 15, mb: 5 })`
  flex-direction: column;
  flex: 1;
  justify-content: center;
  align-items: center;
`;

const Container = styled(Flex)`
  flex-direction: column;
  border-radius: 12px;
  overflow: hidden;
  height: 100%;
  width: 100%;
`;

const Header = styled(Flex).attrs({ py: 6 })``;

export const PageWithHeader: React.FC<
  {
    children: React.ReactNode;
  } & ({ title: string } | BreadCrumbProps)
> = (props) => {
  const { children } = props;
  const headerContent =
    "title" in props ? (
      <Breadcrumb
        segments={[{ label: props.title, value: props.title }]}
        onChange={() => {}}
      />
    ) : (
      <Breadcrumb {...props} />
    );
  return (
    <Root overflow="hidden">
      <Container>
        <Header>{headerContent}</Header>
        <Divider my={4} />
        {children}
      </Container>
    </Root>
  );
};
