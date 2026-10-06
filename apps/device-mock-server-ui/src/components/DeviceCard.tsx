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
  readonly interacting: boolean;
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
  interacting,
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
    api
      .listMocks(token, device.id)
      .then(setMocks)
      .catch((cause: unknown) => onError(describe(cause)));
  }, [token, device.id, onError]);

  useEffect(refreshMocks, [refreshMocks]);

  const setConnected = async (connected: boolean) => {
    setBusy(true);
    try {
      await api.setConnected(token, device.id, connected);
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
    <div className="border-muted bg-base flex flex-col rounded-lg border">
      <div className="flex flex-wrap items-center gap-16 p-16">
        <Spot appearance="icon" icon={model?.icon ?? LedgerDevices} size={40} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-8">
            <p className="body-1-semi-bold text-base">{device.name}</p>
            {device.onboarded === false ? (
              <Tag size="sm" appearance="warning" label="Not onboarded" />
            ) : null}
          </div>
          <p className="body-4 text-muted">{summary}</p>
        </div>
        <label className="body-3 text-muted flex items-center gap-8">
          Connected
          <Switch
            size="sm"
            selected={device.connected}
            disabled={busy}
            onChange={(connected) => void setConnected(connected)}
          />
        </label>
        <Button
          appearance={interacting ? "base" : "gray"}
          size="sm"
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
        className={`border-muted hover:bg-muted-transparent flex items-center gap-8 border-t px-16 py-12 text-left ${
          mocksOpen ? "" : "rounded-b-lg"
        }`}
      >
        <span className="body-2-semi-bold text-base">Mocks</span>
        <span className="body-3 text-muted flex-1">
          {mocks.length === 0
            ? "None"
            : `${mocks.length} mock${mocks.length === 1 ? "" : "s"}`}
        </span>
        {mocksOpen ? (
          <ChevronUp size={20} className="text-muted" />
        ) : (
          <ChevronDown size={20} className="text-muted" />
        )}
      </button>

      {mocksOpen ? (
        <div className="border-muted bg-canvas rounded-b-lg border-t p-16">
          <MocksPanel
            token={token}
            deviceId={device.id}
            mocks={mocks}
            onChanged={refreshMocks}
            onError={onError}
          />
        </div>
      ) : null}
    </div>
  );
}
