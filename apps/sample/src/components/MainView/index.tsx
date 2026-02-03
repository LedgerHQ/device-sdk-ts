import React from "react";
import { Flex, Text } from "@ledgerhq/react-ui";
import Image from "next/image";
import styled, { type DefaultTheme } from "styled-components";

import { ConnectDeviceButtons } from "@/components/ConnectDevice/ConnectDeviceButtons";

const Root = styled(Flex).attrs({ rowGap: 6 })`
  flex: 1;
  justify-content: center;
  align-items: center;
  flex-direction: column;
`;

const Description = styled(Text)`
  color: ${({ theme }: { theme: DefaultTheme }) => theme.colors.neutral.c70};
`;

export const MainView: React.FC = () => {
  return (
    <Root>
      <Image
        src={"/devices_crop.png"}
        alt={"ledger-devices-image"}
        width={400}
        height={330}
      />
      <Text variant={"h2Inter"} fontWeight={"semiBold"} textTransform={"none"}>
        Ledger Device Management Kit
      </Text>
      <Description variant={"body"}>
        Use this application to test Ledger hardware device features.
      </Description>
      <ConnectDeviceButtons />
    </Root>
  );
};
