import React, { useCallback, useEffect, useState } from "react";
import type { DiscoveredDevice } from "@ledgerhq/device-sdk-core";
import { Button, Flex, Text } from "@ledgerhq/react-ui";
import Image from "next/image";
import styled, { DefaultTheme } from "styled-components";

import { useSdk } from "@/providers/DeviceSdkProvider";
import { useSessionContext } from "@/providers/SessionsProvider";

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
  const sdk = useSdk();
  const { dispatch } = useSessionContext();
  const [discoveredDevice, setDiscoveredDevice] =
    useState<null | DiscoveredDevice>(null);

  // Example starting the discovery on a user action
  const onSelectDeviceClicked = useCallback(() => {
    sdk.startDiscovering().subscribe({
      next: (device) => {
        console.log(`🦖 Discovered device: `, device);
        setDiscoveredDevice(device);
      },
      error: (error) => {
        console.error(error);
      },
    });
  }, [sdk]);

  useEffect(() => {
    return () => {
      // Example cleaning up the discovery
      sdk.stopDiscovering();
    };
  }, [sdk]);

  useEffect(() => {
    if (discoveredDevice) {
      sdk
        .connect({ deviceId: discoveredDevice.id })
        .then((sessionId) => {
          console.log(
            `🦖 Response from connect: ${JSON.stringify(sessionId)} 🎉`,
          );
          dispatch({
            type: "add_session",
            payload: {
              sessionId,
              connectedDevice: sdk.getConnectedDevice({ sessionId }),
            },
          });
        })
        .catch((error) => {
          console.error(`Error from connection or get-version`, error);
        });
    }
  }, [sdk, discoveredDevice]);

  return (
    <Root>
      <NanoLogo
        src={"/nano-x.png"}
        alt={"nano-x-logo"}
        width={155}
        height={250}
      />
      <Text variant={"h2Inter"} fontWeight={"semiBold"} textTransform={"none"}>
        Ledger Device SDK
      </Text>
      <Description variant={"body"}>
        Use this application to test Ledger hardware device features.
      </Description>

      <Button
        onClick={onSelectDeviceClicked}
        variant="main"
        backgroundColor="main"
        size="large"
      >
        Select a device
      </Button>
    </Root>
  );
};
