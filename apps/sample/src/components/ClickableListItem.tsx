import React from "react";
import { Flex, Text, Icons } from "@ledgerhq/react-ui";
import styled from "styled-components";

const ListItemWrapper = styled(Flex)`
  opacity: 0.8;

  &:hover {
    opacity: 1;
  }

  cursor: pointer;
`;

export const ClickableListItem: React.FC<{
  title: string;
  description: string;
  onClick(): void;
  icon?: React.ReactNode;
}> = ({ title, description, onClick, icon }) => {
  return (
    <ListItemWrapper
      flexDirection="row"
      alignItems="center"
      p={6}
      backgroundColor={"opacityDefault.c05"}
      borderRadius={2}
      onClick={onClick}
      data-testid={`CTA_command-${title}`}
    >
      {icon}
      <Flex flex={1} flexDirection="column" rowGap={4}>
        <Text variant="large" fontWeight="semiBold">
          {title}
        </Text>
        <Text variant="body" fontWeight="regular" color="opacityDefault.c60">
          {description}
        </Text>
      </Flex>
      <Icons.ChevronRight size="M" color="opacityDefault.c50" />
    </ListItemWrapper>
  );
};
