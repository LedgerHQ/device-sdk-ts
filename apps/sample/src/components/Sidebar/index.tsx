"use client";
import React, { useEffect, useState } from "react";
import { Box, Flex, Icons, Link, Text } from "@ledgerhq/react-ui";
import { useRouter } from "next/navigation";
import styled, { DefaultTheme } from "styled-components";

import { Device } from "@/components/Device";
import { Menu } from "@/components/Menu";
import { useSdk } from "@/providers/DeviceSdkProvider";
import { useSessionContext } from "@/providers/SessionsProvider";

const Root = styled(Flex).attrs({ py: 8, px: 6 })`
  flex-direction: column;
  width: 280px;
  background-color: ${({ theme }: { theme: DefaultTheme }) =>
    theme.colors.background.main};
`;

const Subtitle = styled(Text).attrs({ mb: 5 })``;

const MenuContainer = styled(Box)`
  flex: 1;
  opacity: 0.2;
`;

const BottomContainer = styled(Flex)`
  opacity: 0.2;
  flex-direction: column;
  align-items: center;
`;

const LogsContainer = styled(Flex).attrs({ mb: 6 })`
  flex-direction: row;
  align-items: center;
`;

const LogsText = styled(Text).attrs({ ml: 3 })``;

const VersionText = styled(Text)`
  color: ${({ theme }: { theme: DefaultTheme }) => theme.colors.neutral.c50};
`;

export const Sidebar: React.FC = () => {
  const [version, setVersion] = useState("");
  const sdk = useSdk();
  const {
    state: { deviceById },
  } = useSessionContext();

  useEffect(() => {
    sdk
      .getVersion()
      .then((v) => setVersion(v))
      .catch((error: unknown) => {
        console.error(error as Error);
        setVersion("");
      });
  }, [sdk]);

  const router = useRouter();
  return (
    <Root>
      <Link
        onClick={() => router.push("/")}
        mb={8}
        textProps={{
          textAlign: "left",
          variant: "large",
        }}
      >
        Ledger Device SDK
      </Link>
      <Subtitle variant={"small"}>
        SDK Version: {version ? version : "Loading..."}
      </Subtitle>

      <Subtitle variant={"tiny"}>Device</Subtitle>

      {Object.entries(deviceById).map(([sessionId, device]) => (
        <Device
          key={sessionId}
          name={device.deviceName}
          model={device.deviceModel.id}
          type={device.type}
        />
      ))}

      <MenuContainer>
        <Subtitle variant={"tiny"}>Menu</Subtitle>
        <Menu />
      </MenuContainer>

      <BottomContainer>
        <LogsContainer>
          <Icons.ExternalLink />
          <LogsText variant={"paragraph"}>Share logs</LogsText>
        </LogsContainer>
        <VersionText variant={"body"}>
          Ledger device SDK version 0.0.1
        </VersionText>
        <VersionText variant={"body"}>App version 0.1</VersionText>
      </BottomContainer>
    </Root>
  );
};
