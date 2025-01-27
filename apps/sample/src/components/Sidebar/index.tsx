"use client";
import React, { useCallback, useEffect, useState } from "react";
import { mockserverIdentifier } from "@ledgerhq/device-transport-kit-mockserver";
import { Box, Flex, IconsLegacy, Link, Text } from "@ledgerhq/react-ui";
import { useRouter } from "next/navigation";
import styled, { type DefaultTheme } from "styled-components";

import { AvailableDevices } from "@/components/AvailableDevices";
import { Device } from "@/components/Device";
import { Menu } from "@/components/Menu";
import {
  useDmk,
  useExportLogsCallback,
} from "@/providers/DeviceManagementKitProvider";
import { useDeviceSessionsContext } from "@/providers/DeviceSessionsProvider";
import { useDmkConfigContext } from "@/providers/DmkConfig";

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

const VersionText = styled(Text)`
  color: ${({ theme }: { theme: DefaultTheme }) => theme.colors.neutral.c50};
`;

export const Sidebar: React.FC = () => {
  const [version, setVersion] = useState("");
  const dmk = useDmk();
  const exportLogs = useExportLogsCallback();
  const {
    state: { deviceById, selectedId },
    dispatch,
  } = useDeviceSessionsContext();
  const {
    state: { transport },
  } = useDmkConfigContext();

  useEffect(() => {
    dmk
      .getVersion()
      .then((v) => setVersion(v))
      .catch((error: unknown) => {
        console.error(new Error(String(error)));
        setVersion("");
      });
  }, [dmk]);
  const onDeviceDisconnect = useCallback(
    async (sessionId: string) => {
      try {
        await dmk.disconnect({ sessionId });
        dispatch({ type: "remove_session", payload: { sessionId } });
      } catch (e) {
        console.error(e);
      }
    },
    [dispatch, dmk],
  );

  const router = useRouter();
  return (
    <Root mockServerEnabled={transport === mockserverIdentifier}>
      <Link
        onClick={() => router.push("/")}
        mb={8}
        textProps={{
          textAlign: "left",
          variant: "large",
        }}
      >
        Ledger Device Management Kit
        {transport === mockserverIdentifier && <span> (MOCKED)</span>}
      </Link>

      <Subtitle variant={"tiny"}>
        Device sessions ({Object.values(deviceById).length})
      </Subtitle>
      <div data-testid="container_devices">
        {Object.entries(deviceById).map(([sessionId, device]) => (
          <Device
            key={sessionId}
            sessionId={sessionId}
            name={device.name}
            model={device.modelId}
            type={device.type}
            onSelect={() =>
              dispatch({ type: "select_session", payload: { sessionId } })
            }
            onDisconnect={() => onDeviceDisconnect(sessionId)}
          />
        ))}
      </div>
      <AvailableDevices />
      <MenuContainer active={!!selectedId}>
        <Subtitle variant={"tiny"}>Menu</Subtitle>
        <Menu />
      </MenuContainer>

      <BottomContainer>
        <Link
          mb={6}
          onClick={exportLogs}
          size="large"
          Icon={IconsLegacy.ExternalLinkMedium}
        >
          Share logs
        </Link>
        <VersionText variant={"body"} whiteSpace="pre" textAlign="center">
          Ledger Device Management Kit{"\n"}version {version}
        </VersionText>
      </BottomContainer>
    </Root>
  );
};
