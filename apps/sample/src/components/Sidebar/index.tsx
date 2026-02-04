"use client";
import React, { useCallback, useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { type DeviceSessionId } from "@ledgerhq/device-management-kit";
import { Flex, IconsLegacy, Link, Text } from "@ledgerhq/react-ui";
import { useRouter } from "next/navigation";
import styled, { type DefaultTheme } from "styled-components";

import { AvailableDevices } from "@/components/AvailableDevices";
import { ConnectDeviceMenuDropdown } from "@/components/ConnectDevice/ConnectDeviceMenuDropdown";
import { Device } from "@/components/Device";
import { Menu } from "@/components/Menu";
import {
  useDmk,
  useExportLogsCallback,
} from "@/providers/DeviceManagementKitProvider";
import {
  selectOrderedConnectedDevices,
  selectSelectedSessionId,
} from "@/state/sessions/selectors";
import { setSelectedSession } from "@/state/sessions/slice";
import { selectTransportType } from "@/state/settings/selectors";

const Root = styled(Flex).attrs({ py: 8, px: 6, rowGap: 6 })`
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
      : theme.colors.background.card};
  overflow-y: auto;
`;

const MenuContainer = styled(Flex)`
  flex: 1;
  flex-direction: column;
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
  const orderedConnectedDevices = useSelector(selectOrderedConnectedDevices);
  const selectedSessionId = useSelector(selectSelectedSessionId);
  const dispatch = useDispatch();
  const transportType = useSelector(selectTransportType);

  const selectSession = useCallback(
    (sessionId: DeviceSessionId) => {
      dispatch(setSelectedSession({ sessionId }));
    },
    [dispatch],
  );

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
    <Root mockServerEnabled={transportType === "mockserver"}>
      <Link
        onClick={() => router.push("/")}
        mb={8}
        textProps={{
          textAlign: "left",
          variant: "large",
        }}
      >
        Ledger Device Management Kit
        {transportType === "mockserver" && <span> (MOCKED)</span>}
      </Link>

      <Flex data-testid="container_devices" rowGap={4} flexDirection="column">
        <Text variant={"tiny"}>
          Device sessions ({orderedConnectedDevices.length})
        </Text>
        {orderedConnectedDevices.map(({ sessionId, connectedDevice }) => (
          <Device
            key={sessionId}
            sessionId={sessionId}
            name={connectedDevice.name}
            model={connectedDevice.modelId}
            type={connectedDevice.type}
            onSelect={selectSession}
            onDisconnect={onDeviceDisconnect}
            onReconnect={onDeviceReconnect}
          />
        ))}
      </Flex>
      <AvailableDevices />
      <ConnectDeviceMenuDropdown />
      <MenuContainer active={!!selectedSessionId}>
        <Text variant={"tiny"}>Menu</Text>
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
