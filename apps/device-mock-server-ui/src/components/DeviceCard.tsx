import { type ReactNode, useCallback, useEffect, useState } from "react";
import { type Device, type Mock } from "@ledgerhq/device-mockserver-client";
import {
  Button,
  IconButton,
  SegmentedControl,
  SegmentedControlButton,
  Spot,
  Tag,
} from "@ledgerhq/lumen-ui-react";
import {
  ChevronDown,
  ChevronUp,
  Code,
  LedgerDevices,
  PenEdit,
  Trash,
} from "@ledgerhq/lumen-ui-react/symbols";

import { api } from "@/api/client";
import { ConsolePanel } from "@/components/ConsolePanel";
import { CopyButton } from "@/components/CopyButton";
import { MocksPanel } from "@/components/MocksPanel";
import { findModel, modelLabel } from "@/lib/devices";

type Tab = "overview" | "mocks" | "console";

const TABS: { value: Tab; label: string }[] = [
  { value: "overview", label: "Overview" },
  { value: "mocks", label: "Mocks" },
  { value: "console", label: "APDU console" },
];

interface DeviceCardProps {
  readonly token: string;
  readonly device: Device;
  readonly onChanged: () => void;
  readonly onEdit: () => void;
  readonly onError: (message: string) => void;
}

export function DeviceCard({
  token,
  device,
  onChanged,
  onEdit,
  onError,
}: DeviceCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mocks, setMocks] = useState<Mock[]>([]);

  const model = findModel(device.device_type);
  const apps = (device.apps ?? []).filter(
    (app) => app.name.toUpperCase() !== "BOLOS",
  );

  // Mocks are loaded even while the card is collapsed, so their count can be
  // shown on the card itself rather than only once the tab is opened.
  const refreshMocks = useCallback(() => {
    api
      .listMocks(token, device.id)
      .then(setMocks)
      .catch((cause: unknown) =>
        onError(cause instanceof Error ? cause.message : String(cause)),
      );
  }, [token, device.id, onError]);

  useEffect(refreshMocks, [refreshMocks]);

  const openMocks = () => {
    setTab("mocks");
    setExpanded(true);
  };

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
      onChanged();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const summary = [
    modelLabel(device.device_type),
    device.firmware_version ? `firmware ${device.firmware_version}` : null,
    device.connectivity_type,
    `${apps.length} app${apps.length === 1 ? "" : "s"}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="border-muted bg-base flex flex-col rounded-lg border">
      <div className="flex flex-wrap items-center gap-16 p-16">
        <Spot appearance="icon" icon={model?.icon ?? LedgerDevices} size={40} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-8">
            <p className="body-1-semi-bold text-base">{device.name}</p>
            <Tag
              size="sm"
              appearance={device.connected ? "success" : "gray"}
              label={device.connected ? "Connected" : "Disconnected"}
            />
            {device.onboarded === false ? (
              <Tag size="sm" appearance="warning" label="Not onboarded" />
            ) : null}
            {mocks.length > 0 ? (
              <Tag
                size="sm"
                appearance="accent-subtle"
                label={`${mocks.length} mock${mocks.length === 1 ? "" : "s"}`}
              />
            ) : null}
          </div>
          <p className="body-4 text-muted">{summary}</p>
        </div>

        {confirmingDelete ? (
          <div className="flex items-center gap-8">
            <p className="body-4 text-muted">Remove this device?</p>
            <Button
              appearance="red"
              size="sm"
              loading={busy}
              onClick={() => {
                void run(() => api.deleteDevice(token, device.id));
              }}
            >
              Remove
            </Button>
            <Button
              appearance="no-background"
              size="sm"
              onClick={() => setConfirmingDelete(false)}
            >
              Keep
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <Button
              appearance={device.connected ? "gray" : "base"}
              size="sm"
              loading={busy}
              onClick={() =>
                void run(() =>
                  api.setConnected(token, device.id, !device.connected),
                )
              }
            >
              {device.connected ? "Disconnect" : "Connect"}
            </Button>
            <Button appearance="gray" size="sm" icon={Code} onClick={openMocks}>
              Mocks
            </Button>
            <IconButton
              appearance="no-background"
              size="sm"
              tooltip
              aria-label="Edit device"
              icon={PenEdit}
              onClick={onEdit}
            />
            <IconButton
              appearance="no-background"
              size="sm"
              tooltip
              aria-label="Remove device"
              icon={Trash}
              onClick={() => setConfirmingDelete(true)}
            />
            <IconButton
              appearance="no-background"
              size="sm"
              aria-label={expanded ? "Collapse device" : "Expand device"}
              icon={expanded ? ChevronUp : ChevronDown}
              onClick={() => setExpanded(!expanded)}
            />
          </div>
        )}
      </div>

      {/* The open tab sits in a recessed well: the panel around the card and the
          card itself share a surface colour, leaving it no edge to read
          against. */}
      {expanded ? (
        <div className="border-muted bg-canvas flex flex-col gap-16 rounded-b-lg border-t p-16">
          <SegmentedControl
            selectedValue={tab}
            onSelectedChange={(value) => setTab(value as Tab)}
          >
            {TABS.map((entry) => (
              <SegmentedControlButton key={entry.value} value={entry.value}>
                {entry.label}
              </SegmentedControlButton>
            ))}
          </SegmentedControl>

          {tab === "overview" ? (
            <div className="flex flex-col gap-12">
              <Detail label="Device id">
                <span className="body-3 font-mono break-all">{device.id}</span>
                <CopyButton value={device.id} label="Copy device id" />
              </Detail>
              <Detail label="Memory mask">
                <span className="body-3 font-mono">
                  {(device.masks ?? [])
                    .map((mask) => `0x${mask.toString(16)}`)
                    .join(", ") || "—"}
                </span>
              </Detail>
              <Detail label="Onboarding">
                <span className="body-3">
                  {device.onboarded === false
                    ? "Not onboarded — walk it through the steps from the APDU console."
                    : "Onboarded and ready."}
                </span>
              </Detail>
              <Detail label="Installed apps">
                {apps.length > 0 ? (
                  <div className="flex flex-wrap gap-6">
                    {apps.map((app) => (
                      <Tag
                        key={app.name}
                        size="sm"
                        appearance="gray"
                        label={`${app.name} ${app.version}`}
                      />
                    ))}
                  </div>
                ) : (
                  <span className="body-3 text-muted-subtle">
                    None — Open App will answer 6807 for every app.
                  </span>
                )}
              </Detail>
              <Detail label="Mocks">
                <span className="body-3">
                  {mocks.length === 0
                    ? "None — every command gets the server's own answer."
                    : mocks
                        .map((mock) => `${mock.prefix} → ${mock.responses[0]}`)
                        .join(", ")}
                </span>
              </Detail>
              <div>
                <Button
                  appearance="gray"
                  size="sm"
                  icon={PenEdit}
                  onClick={onEdit}
                >
                  Edit this device
                </Button>
              </div>
            </div>
          ) : null}

          {tab === "mocks" ? (
            <MocksPanel
              token={token}
              deviceId={device.id}
              mocks={mocks}
              onChanged={refreshMocks}
              onError={onError}
            />
          ) : null}

          {tab === "console" ? (
            <ConsolePanel
              token={token}
              device={device}
              onDeviceMayHaveChanged={onChanged}
              onError={onError}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Detail({
  label,
  children,
}: {
  readonly label: string;
  readonly children: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-8">
      <span className="body-4 text-muted w-128 shrink-0">{label}</span>
      <div className="flex min-w-0 items-center gap-4">{children}</div>
    </div>
  );
}
