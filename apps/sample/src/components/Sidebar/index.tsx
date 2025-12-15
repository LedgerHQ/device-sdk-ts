"use client";
import React, { useCallback, useEffect, useState } from "react";
import { type DeviceSessionId } from "@ledgerhq/device-management-kit";
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
import { useDmkConfigContext } from "@/providers/DmkConfig";
import {
  useOrderedConnectedDevices,
  useSelectedSessionId,
  useSelectSession,
} from "@/state/sessions/hooks";

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
  const orderedConnectedDevices = useOrderedConnectedDevices();
  const selectedSessionId = useSelectedSessionId();
  const selectSession = useSelectSession();
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
      } catch (e) {
        console.error(e);
      }
    },
    [dmk],
  );

  const onDeviceReconnect = useCallback(
    async (sessionId: DeviceSessionId) => {
      try {
        const device = dmk.getConnectedDevice({ sessionId });
        await dmk.reconnect({ device });
      } catch (e) {
        console.error(e);
      }
    },
    [dmk],
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
        Device sessions ({orderedConnectedDevices.length})
      </Subtitle>
      <div data-testid="container_devices">
        {orderedConnectedDevices.map(({ sessionId, connectedDevice }) => (
          <Device
            key={sessionId}
            sessionId={sessionId}
            name={connectedDevice.name}
            model={connectedDevice.modelId}
            type={connectedDevice.type}
            onSelect={() => selectSession(sessionId)}
            onDisconnect={() => onDeviceDisconnect(sessionId)}
            onReconnect={() => onDeviceReconnect(sessionId)}
          />
        ))}
      </div>
      <AvailableDevices />
      <MenuContainer active={!!selectedSessionId}>
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
