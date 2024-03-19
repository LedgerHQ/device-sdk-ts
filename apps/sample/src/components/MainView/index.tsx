import React, { useCallback, useEffect, useState } from "react";
import type { DiscoveredDevice } from "@ledgerhq/device-sdk-core";
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
  const [discoveredDevice, setDiscoveredDevice] =
    useState<null | DiscoveredDevice>(null);
  const [connectedDevice, setConnectedDevice] = useState<null | HIDDevice>();

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

  const onDisconnect = useCallback(() => {
    setDiscoveredDevice(null);
  }, []);

  const getDevices = useCallback(async () => {
    if ("hid" in navigator) {
      const [d] = await navigator.hid.getDevices();
      console.log(d);
      setConnectedDevice(d);
    }
  }, []);

  const getEthAddress = useCallback(async () => {
    if (!connectedDevice) return;
    const ethAddressApdu = new Uint8Array([
      0xe0, 0x02, 0x00, 0x00, 0x1d, 0x05, 0x80, 0x00, 0x00, 0x2c, 0x80, 0x00,
      0x00, 0x3c, 0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01,
    ]);

    const header = new Uint8Array([
      0xaa,
      0xaa,
      0x05,
      0x00,
      0x00,
      0x00,
      ethAddressApdu.length,
    ]);

    const getversionapdu = new Uint8Array([
      0xaa, 0xaa, 0x05, 0x00, 0x00, 0x00, 0x05, 0xe0, 0x01, 0x00, 0x00, 0x00,
    ]);

    const fullAPDU = new Uint8Array(header.length + ethAddressApdu.length);
    fullAPDU.set(header, 0);
    fullAPDU.set(ethAddressApdu, header.length);

    await connectedDevice.sendReport(0, fullAPDU);
  }, [connectedDevice]);

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
        .then((connectedDevice: DiscoveredDevice) => {
          console.log(
            `🦖 Response from connect: ${JSON.stringify(connectedDevice)} 🎉`,
          );
        })
        .catch((error: unknown) => {
          console.error(`Error from connection or get-version`, error);
        });
    }

    if (connectedDevice) {
      connectedDevice.addEventListener("inputreport", (event) => {
        const { data, reportId } = event;
        const response = new Uint8Array(data.buffer);
        const toHexString = (bytes: Uint8Array) =>
          bytes.reduce(
            (str, byte) => str + byte.toString(16).padStart(2, "0"),
            "",
          );
        console.log(toHexString(response));

        // .map((x) => x.toString(16))
        // .join(" ");
        // console.log(`Received an input report on ${reportId}: ${response}`);
      });
    }
  }, [sdk, discoveredDevice, connectedDevice]);

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

        {discoveredDevice ? (
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
              onClick={getDevices}
              variant="main"
              backgroundColor="main"
              size="large"
            >
              Get Devices
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
