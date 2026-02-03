import React from "react";
import { Flex, IconsLegacy, Text } from "@ledgerhq/react-ui";
import styled from "styled-components";

import { Dropdown, DropdownItem } from "@/components/Dropdown";
import { useConnectDevice } from "@/hooks/useConnectDevice";

const Title = styled(Text)`
  &:hover {
    user-select: none;
    text-decoration: underline;
    cursor: pointer;
  }
`;

export const ConnectDeviceMenuDropdown: React.FC = () => {
  const { transportOptions, connectWithTransport } = useConnectDevice();

  return (
    <Dropdown
      trigger={
        <Flex flexDirection="row" alignItems="center" columnGap={2}>
          <Title variant="tiny">Connect device</Title>
          <IconsLegacy.PlusMedium size={12} />
        </Flex>
      }
    >
      {transportOptions.map((option) => (
        <DropdownItem
          key={option.identifier}
          onClick={() => connectWithTransport(option.identifier)}
        >
          <Text variant="paragraph" color="neutral.c80">
            {option.label}
          </Text>
        </DropdownItem>
      ))}
    </Dropdown>
  );
};
