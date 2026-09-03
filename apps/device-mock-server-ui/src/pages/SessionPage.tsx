import { useCallback, useEffect, useState } from "react";
import {
  type Device,
  type DeviceConfig,
  type Session,
} from "@ledgerhq/device-mockserver-client";
import {
  Banner,
  Button,
  IconButton,
  Spinner,
  Tag,
} from "@ledgerhq/lumen-ui-react";
import {
  ExitLogout,
  LedgerLogo,
  Plus,
  Refresh,
  Trash,
} from "@ledgerhq/lumen-ui-react/symbols";

import { api } from "@/api/client";
import { CopyButton } from "@/components/CopyButton";
import { DeviceCard } from "@/components/DeviceCard";
import { DeviceDialog } from "@/components/DeviceDialog";
import { LabeledRow } from "@/components/LabeledRow";
import { Panel } from "@/components/Panel";
import { SeedPanel } from "@/components/SeedPanel";
import { ServerStatus } from "@/components/ServerStatus";
import { TransferPanel } from "@/components/TransferPanel";

type DialogTarget = Device | "new" | null;

const relativeExpiry = (expiresAt: number): string => {
  const minutes = Math.round((expiresAt - Date.now()) / 60_000);
  if (minutes <= 0) return "expired";
  if (minutes < 60) return `in ${minutes} min`;
  return `in ${Math.round(minutes / 60)} h`;
};

interface SessionPageProps {
  readonly token: string;
  readonly onLeave: () => void;
  readonly onSwitch: (token: string) => void;
}

export function SessionPage({ token, onLeave, onSwitch }: SessionPageProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [dialog, setDialog] = useState<DialogTarget>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(() => {
    setRefreshing(true);
    api
      .getSession(token)
      .then(setSession)
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : String(cause)),
      )
      .finally(() => setRefreshing(false));
  }, [token]);

  useEffect(refresh, [refresh]);

  const submitDevice = async (config: DeviceConfig) => {
    if (dialog && dialog !== "new") {
      await api.editDevice(token, dialog.id, config);
    } else {
      await api.addDevice(token, config);
    }
    refresh();
  };

  const disposeSession = () => {
    api
      .disposeSession(token)
      .then(onLeave)
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : String(cause)),
      );
  };

  const startFresh = () => {
    api
      .createSession()
      .then(({ token: next }) => onSwitch(next))
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : String(cause)),
      );
  };

  const devices = session?.devices ?? [];

  return (
    <>
      <header className="border-muted bg-canvas sticky top-0 z-10 border-b">
        <div className="mx-auto flex max-w-[1040px] flex-wrap items-center gap-12 px-24 py-16">
          <LedgerLogo size={24} className="text-base" />
          <p className="body-2-semi-bold text-base">Device Mock Server</p>
          <ServerStatus />
          <div className="ml-auto flex items-center gap-8">
            <IconButton
              appearance="no-background"
              size="sm"
              tooltip
              aria-label="Reload this session"
              icon={Refresh}
              onClick={refresh}
            />
            <Button appearance="no-background" size="sm" onClick={startFresh}>
              New session
            </Button>
            <Button
              appearance="gray"
              size="sm"
              icon={ExitLogout}
              onClick={onLeave}
            >
              Switch session
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-[1040px] flex-col gap-24 px-24 py-32">
        {error ? (
          <Banner
            appearance="error"
            title="The mock server said no"
            description={error}
            onClose={() => setError(null)}
            closeAriaLabel="Dismiss error"
          />
        ) : null}

        <Panel
          title="Point your app at this session"
          description="Ledger Live and DMK apps reach the mocked devices through this URL and token."
        >
          <div className="flex flex-col gap-12">
            <LabeledRow label="Server URL">
              <span className="body-3 text-base font-mono">
                {window.location.origin}
              </span>
              <CopyButton value={window.location.origin} label="Copy the URL" />
            </LabeledRow>
            <LabeledRow label="Session token">
              <span className="body-3 text-base font-mono break-all">
                {token}
              </span>
              <CopyButton value={token} label="Copy the token" />
            </LabeledRow>
            <LabeledRow label="Expires">
              <span className="body-3 text-base">
                {session ? relativeExpiry(session.expires_at) : "…"}
              </span>
              <span className="body-4 text-muted">
                the timer resets on every request
              </span>
            </LabeledRow>
          </div>
          <div>
            <Button
              appearance="no-background"
              size="sm"
              icon={Trash}
              onClick={disposeSession}
            >
              Delete this session
            </Button>
          </div>
        </Panel>

        <Panel
          title="Devices"
          description="Each device answers on its own — its metadata drives the handshake, and its mocks override anything else."
          action={
            <div className="flex items-center gap-8">
              <Tag
                size="sm"
                appearance="gray"
                label={`${devices.length} device${
                  devices.length === 1 ? "" : "s"
                }`}
              />
              <Button size="sm" icon={Plus} onClick={() => setDialog("new")}>
                Add a device
              </Button>
            </div>
          }
        >
          {!session && refreshing ? (
            <div className="flex justify-center py-24">
              <Spinner size={24} />
            </div>
          ) : devices.length === 0 ? (
            <div className="border-muted flex flex-col items-center gap-12 rounded-md border border-dashed p-32 text-center">
              <p className="body-2 text-base">No devices in this session yet</p>
              <p className="body-3 text-muted max-w-[420px]">
                Add one and pick its model, firmware and installed apps. A
                connecting app will then discover exactly that device.
              </p>
              <Button size="sm" icon={Plus} onClick={() => setDialog("new")}>
                Add a device
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-12">
              {devices.map((device) => (
                <DeviceCard
                  key={device.id}
                  token={token}
                  device={device}
                  onChanged={refresh}
                  onEdit={() => setDialog(device)}
                  onError={setError}
                />
              ))}
            </div>
          )}
        </Panel>

        <TransferPanel token={token} onImported={refresh} onError={setError} />

        <SeedPanel token={token} onError={setError} />
      </main>

      {dialog ? (
        <DeviceDialog
          device={dialog === "new" ? undefined : dialog}
          existingNames={devices.map((device) => device.name)}
          onClose={() => setDialog(null)}
          onSubmit={submitDevice}
        />
      ) : null}
    </>
  );
}
