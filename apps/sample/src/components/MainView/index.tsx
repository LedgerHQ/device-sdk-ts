import React, { useEffect, useState } from "react";
import { Flex, Text, Button } from "@ledgerhq/react-ui";
import Image from "next/image";
import styled, { DefaultTheme } from "styled-components";

import { SdkError } from "@ledgerhq/device-management-kit";
import { useDeviceSelectionContext } from "@/providers/DeviceSelectionProvider";

const Root = styled(Flex)`
  flex: 1;
  justify-content: center;
  align-items: center;
  flex-direction: column;
`;

const Description = styled(Text).attrs({ my: 6 })`
  color: ${({ theme }: { theme: DefaultTheme }) => theme.colors.neutral.c70};
`;

const NanoLogo = styled(Image).attrs({ mb: 8 })`
  transform: rotate(23deg);
`;

export const MainView: React.FC = () => {
  const [connectionError, setConnectionError] = useState<SdkError | null>(null);
  const { setVisibility: setDeviceSelectionVisibility } =
    useDeviceSelectionContext();

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    if (connectionError) {
      timeoutId = setTimeout(() => {
        setConnectionError(null);
      }, 3000);
    }
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [connectionError]);

  return (
    <Root>
      <NanoLogo
        src={"/nano-x.png"}
        alt={"nano-x-logo"}
        width={155}
        height={250}
      />
      <Text variant={"h2Inter"} fontWeight={"semiBold"} textTransform={"none"}>
        Ledger Device Management Kit
      </Text>
      <Description variant={"body"}>
        Use this application to test Ledger hardware device features.
      </Description>
      <Button
        mx={3}
        variant="main"
        backgroundColor="main"
        size="large"
        data-testid="CTA_open-select-device-drawer"
        onClick={() => setDeviceSelectionVisibility(true)}
      >
        Select a device
      </Button>
    </Root>
  );
};
