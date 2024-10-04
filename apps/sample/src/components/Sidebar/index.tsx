"use client";
import React, { useEffect, useState } from "react";
import { Box, Flex, Icons, Link, Text } from "@ledgerhq/react-ui";
import { useRouter } from "next/navigation";
import styled, { DefaultTheme } from "styled-components";

import { Device } from "@/components/Device";
import { Menu } from "@/components/Menu";
import { useSdk } from "@/providers/DeviceSdkProvider";
import { useDeviceSessionsContext } from "@/providers/DeviceSessionsProvider";
import { useSdkConfigContext } from "@/providers/SdkConfig";
import { BuiltinTransports } from "@ledgerhq/device-management-kit";

const Root = styled(Flex).attrs({ py: 8, px: 6 })`
  flex-direction: column;
  width: 280px;
  background-color: ${({
    theme,
    mockServerEnabled,
  }: {
    theme: DefaultTheme;
    mockServerEnabled: boolean;
  }) =>
    mockServerEnabled
      ? theme.colors.constant.purple
      : theme.colors.background.drawer};
`;

const NoDeviceContainer = styled(Flex).attrs({
  backgroundColor: "opacityDefault.c10",
  mb: 8,
  borderRadius: 2,
})`
  height: 66px;
`;

const Subtitle = styled(Text).attrs({ mb: 5 })``;

const MenuContainer = styled(Box)`
  flex: 1;
  opacity: ${({ active }: { active: boolean }) => (active ? 1 : 0.5)};
`;

const BottomContainer = styled(Flex)`
  opacity: 0.5;
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
    state: { deviceById, selectedId },
  } = useDeviceSessionsContext();
  const {
    state: { transport },
  } = useSdkConfigContext();

  useEffect(() => {
    sdk
      .getVersion()
      .then((v) => setVersion(v))
      .catch((error: unknown) => {
        console.error(new Error(String(error)));
        setVersion("");
      });
  }, [sdk]);

  const router = useRouter();
  return (
    <Root
      mockServerEnabled={transport === BuiltinTransports.MOCK_SERVER}
      data-testid="container_sidebar-view"
    >
      <Link
        onClick={() => router.push("/")}
        mb={8}
        textProps={{
          textAlign: "left",
          variant: "large",
        }}
      >
        Ledger Device Management Kit
        {transport === BuiltinTransports.MOCK_SERVER && <span> (MOCKED)</span>}
      </Link>
      <Subtitle variant={"small"}>
        SDK Version: {version ? version : "Loading..."}
      </Subtitle>

      <Subtitle variant={"tiny"}>Device</Subtitle>
      <div data-testid="container_main-device">
        {selectedId ? (
          <Device
            key={selectedId}
            sessionId={selectedId}
            name={deviceById[selectedId].name}
            model={deviceById[selectedId].modelId}
            type={deviceById[selectedId].type}
            showSelectDeviceAction
          />
        ) : (
          <NoDeviceContainer alignItems="center" justifyContent="center">
            No device connected
          </NoDeviceContainer>
        )}
      </div>
      <MenuContainer active={!!selectedId}>
        <Subtitle variant={"tiny"}>Menu</Subtitle>
        <Menu />
      </MenuContainer>

      <BottomContainer>
        <LogsContainer>
          <Icons.ExternalLink />
          <LogsText variant={"paragraph"}>Share logs</LogsText>
        </LogsContainer>
        <VersionText variant={"body"}>
          Ledger Device Management Kit version {version}
        </VersionText>
        <VersionText variant={"body"}>App version 0.1</VersionText>
      </BottomContainer>
    </Root>
  );
};
