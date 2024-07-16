"use client";
import React, { useCallback, useEffect, useState } from "react";
import { Box, Flex, Icons, Link, Text } from "@ledgerhq/react-ui";
import { useRouter } from "next/navigation";
import styled, { DefaultTheme } from "styled-components";

import { Device } from "@/components/Device";
import { Menu } from "@/components/Menu";
import { useSdk } from "@/providers/DeviceSdkProvider";
import { useDeviceSessionsContext } from "@/providers/DeviceSessionsProvider";
import { useMockServerContext } from "@/providers/MockServerProvider";

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
    dispatch,
  } = useDeviceSessionsContext();
  const {
    state: { enabled: mockServerEnabled },
  } = useMockServerContext();

  useEffect(() => {
    sdk
      .getVersion()
      .then((v) => setVersion(v))
      .catch((error: unknown) => {
        console.error(new Error(String(error)));
        setVersion("");
      });
  }, [sdk]);
  const onDeviceDisconnect = useCallback(
    async (sessionId: string) => {
      try {
        await sdk.disconnect({ sessionId });
        dispatch({ type: "remove_session", payload: { sessionId } });
      } catch (e) {
        console.error(e);
      }
    },
    [dispatch, sdk],
  );

  const router = useRouter();
  return (
    <Root mockServerEnabled={mockServerEnabled}>
      <Link
        onClick={() => router.push("/")}
        mb={8}
        textProps={{
          textAlign: "left",
          variant: "large",
        }}
      >
        Ledger Device SDK{mockServerEnabled && <span> (MOCKED)</span>}
      </Link>
      <Subtitle variant={"small"}>
        SDK Version: {version ? version : "Loading..."}
      </Subtitle>

      <Subtitle variant={"tiny"}>Device</Subtitle>

      {Object.entries(deviceById).map(([sessionId, device]) => (
        <Device
          key={sessionId}
          sessionId={sessionId}
          name={device.name}
          model={device.modelId}
          type={device.type}
          onDisconnect={async () => onDeviceDisconnect(sessionId)}
        />
      ))}

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
          Ledger device SDK version {version}
        </VersionText>
        <VersionText variant={"body"}>App version 0.1</VersionText>
      </BottomContainer>
    </Root>
  );
};
