import React from "react";
import { Drawer, Flex, Text } from "@ledgerhq/react-ui";
import styled from "styled-components";

const DescriptionText = styled(Text).attrs({
  mb: 5,
  variant: "body",
  color: "opacityDefault.c60",
})`
  font-weight: regular;
`;

export const StyledDrawer: React.FC<{
  title: string;
  big: boolean;
  isOpen: boolean;
  onClose(): void;
  children: React.ReactNode;
  description?: string;
}> = ({ title, description, big, isOpen, onClose, children }) => {
  return (
    <Drawer isOpen={isOpen} onClose={onClose} big={big} title={title}>
      <Flex flexDirection="column" rowGap={4} flex={1} overflowY="hidden">
        {description && <DescriptionText>{description}</DescriptionText>}
        {children}
      </Flex>
    </Drawer>
  );
};
