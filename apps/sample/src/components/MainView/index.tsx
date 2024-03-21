import React, { useCallback, useEffect, useState } from "react";
import { Button, Flex, Icons, Text } from "@ledgerhq/react-ui";
import Image from "next/image";
import styled, { DefaultTheme } from "styled-components";

import { useSdk } from "@/providers/DeviceSdkProvider";

const Root = styled(Flex)`
  flex-direction: column;
  flex: 1;
`;

const Header = styled(Flex).attrs({ py: 3, px: 10, gridGap: 8 })`
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

const Container = styled(Flex)`
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
  const sdk = useSdk();
  const [connected, setConnected] = useState(false);

  // Example starting the discovery on a user action
  const onSelectDeviceClicked = useCallback(() => {
    sdk.hackConnectAndDiscover();
    setConnected(true);
  }, [sdk]);

  const onDisconnect = useCallback(() => {
    sdk.hackDisconnect();
    setConnected(false);
  }, [sdk]);

  const getEthAddress = useCallback(async () => {
    if (!connected) return;

    const address = await sdk.hackGetEthAddress();
    console.log("address", address);
  }, [sdk, connected]);

  useEffect(() => {
    return () => {
      // Example cleaning up the discovery
      sdk.stopDiscovering();
    };
  }, [sdk]);

  return (
    <Root>
      <Header>
        <Actions>
          <IconBox>
            <Icons.Question size={"M"} />
          </IconBox>
          <IconBox>
            <Icons.Settings size={"M"} />
          </IconBox>
        </Actions>
      </Header>

      <Container>
        <NanoLogo
          src={"/nano-x.png"}
          alt={"nano-x-logo"}
          width={155}
          height={250}
        />
        <Text
          variant={"h2Inter"}
          fontWeight={"semiBold"}
          textTransform={"none"}
        >
          Ledger Device SDK
        </Text>
        <Description variant={"body"}>
          Use this application to test Ledger hardware device features.
        </Description>

        {connected ? (
          <>
            <Button
              onClick={getEthAddress}
              variant="main"
              backgroundColor="main"
              size="large"
            >
              Get Eth Address
            </Button>
            <br />
            <Button
              onClick={onDisconnect}
              variant="main"
              backgroundColor="main"
              size="large"
            >
              Disconnect
            </Button>
          </>
        ) : (
          <Button
            onClick={onSelectDeviceClicked}
            variant="main"
            backgroundColor="main"
            size="large"
          >
            Select a device
          </Button>
        )}
      </Container>
    </Root>
  );
};
