"use client";
import React, { useCallback, useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { type DeviceSessionId } from "@ledgerhq/device-management-kit";
import {
  Button,
  Flex,
  Icons,
  IconsLegacy,
  Link,
  Text,
} from "@ledgerhq/react-ui";
import { useRouter } from "next/navigation";
import styled, { type DefaultTheme } from "styled-components";

import { AvailableDevices } from "@/components/AvailableDevices";
import { ConnectDeviceMenuDropdown } from "@/components/ConnectDevice/ConnectDeviceMenuDropdown";
import { Device } from "@/components/Device";
import { DeviceScreen } from "@/components/DeviceScreen";
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
  selectMockServerSessionToken,
  selectMockServerUrl,
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

const MockSessionCard = styled(Flex).attrs({
  p: 5,
  borderRadius: 2,
  rowGap: 4,
})`
  flex-direction: column;
  background: ${({ theme }: { theme: DefaultTheme }) =>
    theme.colors.neutral.c30};
`;

const MockSessionIcon = styled(Flex).attrs({ p: 3, mr: 3, borderRadius: 100 })`
  position: relative;
  justify-content: center;
  align-items: center;
  background: ${({ theme }: { theme: DefaultTheme }) =>
    theme.colors.neutral.c40};
`;

const StatusDot = styled.span<{ $active: boolean }>`
  position: absolute;
  right: 0;
  bottom: 0;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 2px solid
    ${({ theme }: { theme: DefaultTheme }) => theme.colors.neutral.c30};
  background-color: ${({
    theme,
    $active,
  }: {
    theme: DefaultTheme;
    $active: boolean;
  }) => ($active ? theme.colors.success.c50 : theme.colors.error.c50)};
`;

const MockServerSessionCard: React.FC = () => {
  const { status, session } = useMockServerSession();
  const mockServerUrl = useSelector(selectMockServerUrl);
  const sessionToken = useSelector(selectMockServerSessionToken);
  const [copied, setCopied] = useState(false);

  const openMockServerUi = useCallback(() => {
    // The Mock Server UI joins the session given in the URL fragment.
    window.open(
      `${mockServerUrl.replace(/\/$/, "")}/#token=${sessionToken}`,
      "_blank",
      "noopener",
    );
  }, [mockServerUrl, sessionToken]);

  const copyToken = useCallback(() => {
    navigator.clipboard
      .writeText(sessionToken)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch((error: unknown) => {
        console.error("Failed to copy the session token", error);
      });
  }, [sessionToken]);

  if (status === "disabled") return null;

  const active = status === "active" && session !== null;
  const expiresInMinutes = session
    ? Math.max(0, Math.round((session.expires_at - Date.now()) / 60000))
    : 0;

  const details =
    status === "checking"
      ? "Connecting…"
      : active
        ? `Session ${session.id.slice(0, 8)} · ${expiresInMinutes} min left`
        : "Server unreachable";

  return (
    <MockSessionCard data-testid="card_mock-session">
      <Flex alignItems="center">
        <MockSessionIcon>
          <Icons.LedgerDevices size="S" />
          <StatusDot $active={active} />
        </MockSessionIcon>
        <Flex flexDirection="column" flex={1} minWidth={0}>
          <Text variant="body">Mock server</Text>
          <Text
            variant="small"
            color="neutral.c70"
            whiteSpace="nowrap"
            overflow="hidden"
            textOverflow="ellipsis"
          >
            {details}
          </Text>
        </Flex>
      </Flex>
      {active && (
        <Flex columnGap={3}>
          <Button
            data-testid="CTA_open-mock-server-ui"
            size="xs"
            variant="shade"
            outline
            flex={1}
            Icon={IconsLegacy.ExternalLinkMedium}
            onClick={openMockServerUi}
          >
            Open UI
          </Button>
          <Button
            data-testid="CTA_copy-mock-session-token"
            size="xs"
            variant="shade"
            outline
            flex={1}
            Icon={
              copied ? IconsLegacy.CheckAloneMedium : IconsLegacy.CopyMedium
            }
            onClick={copyToken}
          >
            {copied ? "Copied" : "Copy token"}
          </Button>
        </Flex>
      )}
    </MockSessionCard>
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

      <MockServerSessionCard />

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
      <DeviceScreen />
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
