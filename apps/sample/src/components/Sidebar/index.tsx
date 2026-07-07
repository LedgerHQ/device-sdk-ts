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
import { useMockServerSession } from "@/hooks/useMockServerSession";
import {
  useDmk,
  useExportLogsCallback,
} from "@/providers/DeviceManagementKitProvider";
import {
  selectOrderedConnectedDevices,
  selectSelectedSessionId,
} from "@/state/sessions/selectors";
import { setSelectedSession } from "@/state/sessions/slice";
import {
  selectPollingInterval,
  selectTransportType,
} from "@/state/settings/selectors";
import { buildSessionRefresherOptions } from "@/utils/sessionRefresherOptions";

const Root = styled(Flex).attrs({ py: 8, px: 6, rowGap: 6 })`
  flex-direction: column;
  width: 280px;
  background-color: ${({ theme }: { theme: DefaultTheme }) =>
    theme.colors.background.card};
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

const SessionStatusRow = styled(Flex)`
  align-items: center;
  column-gap: 6px;
`;

const StatusDot = styled.span<{ $active: boolean }>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  background-color: ${({
    theme,
    $active,
  }: {
    theme: DefaultTheme;
    $active: boolean;
  }) => ($active ? theme.colors.success.c50 : theme.colors.error.c50)};
`;

const MockServerSessionIndicator: React.FC = () => {
  const { status, session, shared } = useMockServerSession();

  if (status === "disabled") return null;

  const expiresInMinutes = session
    ? Math.max(0, Math.round((session.expires_at - Date.now()) / 60000))
    : 0;

  const label =
    status === "checking"
      ? "Mock session: checking…"
      : status === "active" && session
        ? `Mock session: ${session.id.slice(0, 8)} · ${expiresInMinutes}m · ${
            shared ? "shared" : "auto"
          }`
        : "Mock session: none (server unreachable)";

  return (
    <SessionStatusRow>
      <StatusDot $active={status === "active"} />
      <Text variant="tiny" color="neutral.c70">
        {label}
      </Text>
    </SessionStatusRow>
  );
};

export const Sidebar: React.FC = () => {
  const [version, setVersion] = useState("");
  const dmk = useDmk();
  const exportLogs = useExportLogsCallback();
  const orderedConnectedDevices = useSelector(selectOrderedConnectedDevices);
  const selectedSessionId = useSelector(selectSelectedSessionId);
  const dispatch = useDispatch();
  const transportType = useSelector(selectTransportType);
  const pollingInterval = useSelector(selectPollingInterval);

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
        await dmk.reconnect({
          device,
          sessionRefresherOptions:
            buildSessionRefresherOptions(pollingInterval),
        });
      } catch (e) {
        console.error(e);
      }
    },
    [dmk, pollingInterval],
  );

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
        Ledger Device Management Kit
        {transportType === "mockserver" && <span> (MOCKED)</span>}
      </Link>

      <MockServerSessionIndicator />

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
