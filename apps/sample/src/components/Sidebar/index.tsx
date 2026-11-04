"use client";
import React, { useCallback, useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { type DeviceSessionId } from "@ledgerhq/device-management-kit";
import { cn } from "@ledgerhq/lumen-design-core/cn";
import { Button, Link } from "@ledgerhq/lumen-ui-react";
import {
  Check,
  Copy,
  ExternalLink,
  LedgerDevices,
} from "@ledgerhq/lumen-ui-react/symbols";
import { useRouter } from "next/navigation";

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
    <div
      className="flex flex-col gap-8 rounded-md bg-muted p-12"
      data-testid="card_mock-session"
    >
      <div className="flex items-center">
        <div className="relative mr-12 flex items-center justify-center rounded-full bg-muted-transparent p-12">
          <LedgerDevices size={20} className="text-base" />
          <span
            className={cn(
              "absolute right-0 bottom-0 size-10 rounded-full border-2 border-[#1f1f1f]",
              active ? "bg-success" : "bg-error",
            )}
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="body-2 text-base">Mock server</span>
          <span className="body-3 truncate text-muted">{details}</span>
        </div>
      </div>
      {active && (
        <div className="flex gap-8">
          <Button
            data-testid="CTA_open-mock-server-ui"
            appearance="gray"
            size="sm"
            className="min-w-0 flex-1 bg-muted-transparent px-8"
            icon={ExternalLink}
            onClick={openMockServerUi}
          >
            Open UI
          </Button>
          <Button
            data-testid="CTA_copy-mock-session-token"
            appearance="gray"
            size="sm"
            className="min-w-0 flex-1 bg-muted-transparent px-8"
            icon={copied ? Check : Copy}
            onClick={copyToken}
          >
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      )}
    </div>
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
    <div className="flex w-[312px] shrink-0 flex-col gap-16 overflow-y-auto bg-surface px-16 py-24">
      <button
        className="body-1-semi-bold mb-24 cursor-pointer border-0 bg-transparent p-0 text-left text-base hover:underline"
        onClick={() => router.push("/")}
      >
        Ledger Device Management Kit
        {transportType === "mockserver" && <span> (MOCKED)</span>}
      </button>

      <MockServerSessionCard />

      <div data-testid="container_devices" className="flex flex-col gap-16">
        <span className="body-3 text-base">
          Device sessions ({orderedConnectedDevices.length})
        </span>
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
      </div>
      <DeviceScreen />
      <AvailableDevices />
      <ConnectDeviceMenuDropdown />
      <div
        className={cn(
          "flex flex-1 flex-col",
          selectedSessionId ? "opacity-100" : "opacity-50",
        )}
      >
        <span className="body-3 text-base">Menu</span>
        <Menu />
      </div>

      <div className="flex flex-col items-center opacity-50">
        <Link
          appearance="base"
          size="md"
          className="mb-24"
          icon={ExternalLink}
          onClick={exportLogs}
        >
          Share logs
        </Link>
        <span className="body-2 text-center whitespace-pre text-muted-subtle">
          Ledger Device Management Kit{"\n"}version {version}
        </span>
      </div>
    </div>
  );
};
