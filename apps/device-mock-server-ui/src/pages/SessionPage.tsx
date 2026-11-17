import { useCallback, useEffect, useState } from "react";
import {
  type Device,
  type DeviceConfig,
  type Session,
} from "@ledgerhq/device-mockserver-client";
import { MockServerDevice } from "@ledgerhq/device-mockserver-react";
import {
  Banner,
  Button,
  IconButton,
  Spinner,
  Tag,
} from "@ledgerhq/lumen-ui-react";
import {
  ExitLogout,
  Plus,
  QrCode,
  Refresh,
  Trash,
} from "@ledgerhq/lumen-ui-react/symbols";

import { api } from "@/api/client";
import { CopyButton } from "@/components/CopyButton";
import { DeviceCard } from "@/components/DeviceCard";
import { DeviceDialog } from "@/components/DeviceDialog";
import { LabeledRow } from "@/components/LabeledRow";
import { LedgerWalletDialog } from "@/components/LedgerWalletDialog";
import { MockServerLogo } from "@/components/MockServerLogo";
import { Panel } from "@/components/Panel";
import { SeedPanel } from "@/components/SeedPanel";
import { ServerStatus } from "@/components/ServerStatus";
import { TransferPanel } from "@/components/TransferPanel";

type DialogTarget = Device | "new" | null;

/**
 * A device the user disabled in this page. The page deleted it on the server
 * and keeps what `GET /export` said about it, id and mocks included. Enabling
 * posts it back, so it comes back with the same id. A reload forgets it.
 */
interface DisabledDevice {
  readonly id: string;
  readonly config: DeviceConfig;
  readonly disabledAt: number;
}

/** How a disabled device shows on its card, from the settings the UI kept. */
const toDevice = ({ id, config }: DisabledDevice): Device => ({
  id,
  name: config.name ?? id,
  device_type: config.device_type ?? "",
  connectivity_type: config.connectivity_type ?? "",
  firmware_version: config.firmware_version,
  apps: config.apps,
  masks: config.masks,
  onboarded: config.onboarded,
  language: config.language,
  connected: false,
});

/** The dialog leaves out a field to keep its value, as `PATCH` does. */
const withoutUndefined = (config: DeviceConfig): DeviceConfig =>
  Object.fromEntries(
    Object.entries(config).filter(([, value]) => value !== undefined),
  ) as DeviceConfig;

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
  const [ledgerWalletOpen, setLedgerWalletOpen] = useState(false);
  const [interactingId, setInteractingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [seed, setSeed] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [disabled, setDisabled] = useState<DisabledDevice[]>([]);

  const refresh = useCallback(() => {
    const startedAt = Date.now();
    setRefreshing(true);
    api
      .getSession(token)
      .then((next) => {
        setSession(next);
        setError(null);
        // A device that is on the server again (an import, or a client that
        // attached the same id) is no longer disabled. A device disabled after
        // this request started is still on the server in this answer, so keep it.
        const live = new Set(next.devices.map(({ id }) => id));
        setDisabled((current) => {
          const kept = current.filter(
            ({ id, disabledAt }) => disabledAt > startedAt || !live.has(id),
          );
          return kept.length === current.length ? current : kept;
        });
      })
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : String(cause)),
      )
      .finally(() => setRefreshing(false));
  }, [token]);

  useEffect(refresh, [refresh]);

  const isDisabled = (deviceId: string) =>
    disabled.some(({ id }) => id === deviceId);

  const submitDevice = async (config: DeviceConfig) => {
    if (dialog && dialog !== "new" && isDisabled(dialog.id)) {
      // Not on the server: change the settings it gets back when enabled.
      setDisabled((current) =>
        current.map((entry) =>
          entry.id === dialog.id
            ? {
                ...entry,
                config: { ...entry.config, ...withoutUndefined(config) },
              }
            : entry,
        ),
      );
      return;
    }
    if (dialog && dialog !== "new") {
      await api.editDevice(token, dialog.id, config);
    } else {
      await api.addDevice(token, config);
    }
    refresh();
  };

  const removeDevice = async (deviceId: string) => {
    if (isDisabled(deviceId)) {
      setDisabled((current) => current.filter(({ id }) => id !== deviceId));
      return;
    }
    await api.deleteDevice(token, deviceId);
    if (interactingId === deviceId) setInteractingId(null);
    refresh();
  };

  /**
   * Disabling deletes the device on the server, so apps stop finding it, and
   * keeps its export entry here. Enabling attaches that entry again: same id,
   * settings and mocks.
   */
  const setEnabled = async (device: Device, enabled: boolean) => {
    if (enabled) {
      const entry = disabled.find(({ id }) => id === device.id);
      if (!entry) return;
      await api.addDevice(token, entry.config);
      setDisabled((current) => current.filter(({ id }) => id !== device.id));
      return;
    }
    const snapshot = await api.exportSession(token);
    const config = snapshot.devices.find(({ id }) => id === device.id);
    if (!config) throw new Error(`${device.name} is no longer on the server`);
    await api.deleteDevice(token, device.id);
    setDisabled((current) => [
      ...current,
      { id: device.id, config, disabledAt: Date.now() },
    ]);
    if (interactingId === device.id) setInteractingId(null);
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

  const liveDevices = session?.devices ?? [];
  const liveIds = new Set(liveDevices.map(({ id }) => id));
  const disabledDevices = disabled.filter(({ id }) => !liveIds.has(id));
  const devices = [...liveDevices, ...disabledDevices.map(toDevice)];
  const interacting = liveDevices.find(({ id }) => id === interactingId);

  return (
    <>
      <header className="border-muted bg-canvas sticky top-0 z-10 border-b">
        <div className="mx-auto flex max-w-[1040px] flex-wrap items-center gap-12 px-24 py-16">
          <MockServerLogo size={24} className="text-base" />
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
          action={
            <Button
              size="sm"
              icon={QrCode}
              onClick={() => setLedgerWalletOpen(true)}
            >
              Use in Ledger Wallet
            </Button>
          }
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
            <div className="bg-muted-transparent flex flex-col items-center gap-12 rounded-md p-32 text-center">
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
                  enabled={liveIds.has(device.id)}
                  savedMockCount={
                    disabledDevices.find(({ id }) => id === device.id)?.config
                      .mocks?.length ?? 0
                  }
                  interacting={device.id === interacting?.id}
                  onEnabledChange={(enabled) => setEnabled(device, enabled)}
                  onChanged={refresh}
                  onEdit={() => setDialog(device)}
                  onInteract={() =>
                    setInteractingId(
                      device.id === interacting?.id ? null : device.id,
                    )
                  }
                  onError={setError}
                />
              ))}
            </div>
          )}
        </Panel>

        <TransferPanel
          token={token}
          seed={seed}
          onSeedLoaded={setSeed}
          onImported={refresh}
          onError={setError}
        />

        <SeedPanel
          token={token}
          seed={seed}
          onSeedChange={setSeed}
          onError={setError}
        />
      </main>

      {interacting ? (
        <MockServerDevice
          key={`${interacting.id}:${interacting.device_type}:${interacting.firmware_version}`}
          url={window.location.origin}
          token={token}
          deviceId={interacting.id}
          floating
        />
      ) : null}

      {ledgerWalletOpen ? (
        <LedgerWalletDialog
          url={window.location.origin}
          token={token}
          onClose={() => setLedgerWalletOpen(false)}
        />
      ) : null}

      {dialog ? (
        <DeviceDialog
          device={dialog === "new" ? undefined : dialog}
          existingNames={devices.map((device) => device.name)}
          onClose={() => setDialog(null)}
          onSubmit={submitDevice}
          onRemove={
            dialog === "new" ? undefined : () => removeDevice(dialog.id)
          }
        />
      ) : null}
    </>
  );
}
