import React from "react";
import { Flex, Icons, Text } from "@ledgerhq/react-ui";
import { type BaseStyledProps } from "@ledgerhq/react-ui/components/styled";
import styled from "styled-components";

const ListItemWrapper = styled(Flex)`
  &:hover {
    background-color: ${({ theme }: { theme: DefaultTheme }) =>
      theme.colors.neutral.c30};
  }

  cursor: pointer;
`;

export const ClickableListItem: React.FC<
  {
    title: string;
    description: string;
    onClick(): void;
    icon?: React.ReactNode;
  } & BaseStyledProps
> = ({ title, description, onClick, icon, ...styleProps }) => {
  return (
    <ListItemWrapper
      flexDirection="row"
      alignItems="center"
      p={6}
      backgroundColor={"background.card"}
      borderRadius={2}
      onClick={onClick}
      data-testid={`CTA_command-${title}`}
      {...styleProps}
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
