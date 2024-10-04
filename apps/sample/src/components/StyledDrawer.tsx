import React from "react";
import { Flex, Text, Drawer } from "@ledgerhq/react-ui";

export const StyledDrawer: React.FC<{
  title: string;
  description?: string;
  big: boolean;
  isOpen: boolean;
  onClose(): void;
  children: React.ReactNode;
}> = ({ title, description, big, isOpen, onClose, children }) => {
  return (
    <Drawer isOpen={isOpen} onClose={onClose} big={big} title={title}>
      <Flex flexDirection="column" rowGap={4} flex={1} overflowY="hidden">
        {description && (
          <Text
            variant="body"
            fontWeight="regular"
            color="opacityDefault.c60"
            mb={5}
          >
            {description}
          </Text>
        )}
        {children}
      </Flex>
    </Drawer>
  );
};
