import { useCallback, useEffect, useState } from "react";
import { type Device, type Mock } from "@ledgerhq/device-mockserver-client";
import {
  Button,
  IconButton,
  Spot,
  Switch,
  Tag,
} from "@ledgerhq/lumen-ui-react";
import {
  ChevronDown,
  ChevronUp,
  LedgerDevices,
  Settings,
} from "@ledgerhq/lumen-ui-react/symbols";

import { api } from "@/api/client";
import { MocksPanel } from "@/components/MocksPanel";
import { findModel } from "@/domain/devices";

interface DeviceCardProps {
  readonly token: string;
  readonly device: Device;
  /**
   * A disabled device is not on the server: the UI deleted it and keeps its
   * settings and mocks until it is enabled again with the same id.
   */
  readonly enabled: boolean;
  /** The mocks a disabled device gets back when it is enabled. */
  readonly savedMockCount: number;
  readonly interacting: boolean;
  readonly onEnabledChange: (enabled: boolean) => Promise<void>;
  readonly onChanged: () => void;
  readonly onEdit: () => void;
  readonly onInteract: () => void;
  readonly onError: (message: string) => void;
}

const describe = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause);

export function DeviceCard({
  token,
  device,
  enabled,
  savedMockCount,
  interacting,
  onEnabledChange,
  onChanged,
  onEdit,
  onInteract,
  onError,
}: DeviceCardProps) {
  const [mocksOpen, setMocksOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mocks, setMocks] = useState<Mock[]>([]);

  const model = findModel(device.device_type);
  const apps = (device.apps ?? []).filter(
    (app) => app.name.toUpperCase() !== "BOLOS",
  );

  const refreshMocks = useCallback(() => {
    // A disabled device is not on the server, so it has no mocks to list.
    if (!enabled) return;
    api
      .listMocks(token, device.id)
      .then(setMocks)
      .catch((cause: unknown) => onError(describe(cause)));
  }, [token, device.id, enabled, onError]);

  useEffect(refreshMocks, [refreshMocks]);

  const mockCount = enabled ? mocks.length : savedMockCount;

  const update = async (change: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await change();
      onChanged();
    } catch (cause) {
      onError(describe(cause));
    } finally {
      setBusy(false);
    }
  };

  const summary = [
    [model?.label ?? device.device_type, device.firmware_version]
      .filter(Boolean)
      .join(" "),
    device.connectivity_type,
    `${apps.length} app${apps.length === 1 ? "" : "s"}`,
  ].join(" · ");

  return (
    <div className="bg-base flex flex-col rounded-lg">
      <div className="flex flex-wrap items-center gap-16 p-16">
        <Spot icon={model?.icon ?? LedgerDevices} size={40} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-8">
            <p className="body-1-semi-bold text-base">{device.name}</p>
            {enabled ? null : (
              <Tag size="sm" appearance="gray" label="Disabled" />
            )}
            {device.onboarded === false ? (
              <Tag size="sm" appearance="warning" label="Not onboarded" />
            ) : null}
          </div>
          <p className="body-4 text-muted">{summary}</p>
        </div>
        {/* Disabled: apps do not discover the device and cannot connect to it. */}
        <label className="body-3 text-muted flex items-center gap-8">
          Enabled
          <Switch
            size="sm"
            selected={enabled}
            disabled={busy}
            onChange={(next) => void update(() => onEnabledChange(next))}
          />
        </label>
        <label className="body-3 text-muted flex items-center gap-8">
          Connected
          <Switch
            size="sm"
            selected={enabled && device.connected}
            disabled={busy || !enabled}
            onChange={(next) =>
              void update(() => api.setConnected(token, device.id, next))
            }
          />
        </label>
        <Button
          appearance={interacting ? "base" : "gray"}
          size="sm"
          disabled={!enabled}
          onClick={onInteract}
        >
          {interacting ? "Close screen" : "Interact"}
        </Button>
        <IconButton
          appearance="no-background"
          size="sm"
          tooltip
          aria-label="Device settings"
          icon={Settings}
          onClick={onEdit}
        />
      </div>

      <button
        type="button"
        aria-expanded={mocksOpen}
        onClick={() => setMocksOpen(!mocksOpen)}
        className={`hover:bg-muted-transparent flex items-center gap-8 px-16 py-12 text-left ${
          mocksOpen ? "" : "rounded-b-lg"
        }`}
      >
        <span className="body-2-semi-bold text-base">Mocks</span>
        <span className="body-3 text-muted flex-1">
          {mockCount === 0
            ? "None"
            : `${mockCount} mock${mockCount === 1 ? "" : "s"}`}
        </span>
        {mocksOpen ? (
          <ChevronUp size={20} className="text-muted" />
        ) : (
          <ChevronDown size={20} className="text-muted" />
        )}
      </button>

      {mocksOpen ? (
        <div className="bg-canvas rounded-b-lg p-16">
          {enabled ? (
            <MocksPanel
              token={token}
              deviceId={device.id}
              mocks={mocks}
              onChanged={refreshMocks}
              onError={onError}
            />
          ) : (
            <p className="body-3 text-muted">
              Enable the device to see and change its mocks.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
