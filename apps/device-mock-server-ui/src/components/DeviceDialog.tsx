import { type ReactNode, useState } from "react";
import {
  type Device,
  type DeviceApp,
  type DeviceConfig,
} from "@ledgerhq/device-mockserver-client";
import {
  Banner,
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  IconButton,
  SearchInput,
  SegmentedControl,
  SegmentedControlButton,
  Select,
  SelectContent,
  SelectItem,
  SelectItemText,
  SelectList,
  SelectTrigger,
  Spinner,
  Spot,
  Switch,
  TextInput,
} from "@ledgerhq/lumen-ui-react";
import { LedgerDevices, Plus, Trash } from "@ledgerhq/lumen-ui-react/symbols";

import {
  CONNECTIVITY_TYPES,
  DEVICE_MODELS,
  type DeviceModel,
  findModel,
  isSignerApp,
  nextDeviceName,
} from "@/lib/devices";
import { type DeviceCatalog, useDeviceCatalog } from "@/lib/useDeviceCatalog";

interface DeviceDialogProps {
  readonly token: string;
  /** The device being edited, or `undefined` to create a new one. */
  readonly device?: Device;
  /** Names already taken, so a new device gets a free one. */
  readonly existingNames: string[];
  readonly onClose: () => void;
  readonly onSubmit: (config: DeviceConfig) => Promise<void>;
}

interface FormState {
  name: string;
  deviceType: string;
  connectivityType: string;
  firmwareVersion: string;
  onboarded: boolean;
  apps: DeviceApp[];
}

const DEFAULT_MODEL = DEVICE_MODELS[2]!; // Nano X, the server's own default.

const initialState = (
  device: Device | undefined,
  existingNames: string[],
): FormState => {
  if (device) {
    return {
      name: device.name,
      deviceType: device.device_type,
      connectivityType: device.connectivity_type,
      firmwareVersion: device.firmware_version ?? "",
      onboarded: device.onboarded !== false,
      apps: device.apps ? [...device.apps] : [],
    };
  }
  return {
    name: nextDeviceName(DEFAULT_MODEL, existingNames),
    deviceType: DEFAULT_MODEL.value,
    connectivityType: "USB",
    firmwareVersion: DEFAULT_MODEL.defaultFirmware,
    onboarded: true,
    apps: [],
  };
};

export function DeviceDialog({
  token,
  device,
  existingNames,
  onClose,
  onSubmit,
}: DeviceDialogProps) {
  const [form, setForm] = useState<FormState>(() =>
    initialState(device, existingNames),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const model = findModel(form.deviceType);
  const catalog = useDeviceCatalog(
    token,
    form.deviceType,
    form.firmwareVersion,
  );
  const patch = (values: Partial<FormState>) =>
    setForm((current) => ({ ...current, ...values }));

  // Picking a model rewrites the fields that are really model defaults, unless
  // this is an edit (where the user's own values must survive).
  const pickModel = (next: DeviceModel) =>
    patch(
      device
        ? { deviceType: next.value }
        : {
            deviceType: next.value,
            name: nextDeviceName(next, existingNames),
            firmwareVersion: next.defaultFirmware,
          },
    );

  const updateApp = (index: number, values: Partial<DeviceApp>) =>
    patch({
      apps: form.apps.map((app, i) =>
        i === index ? { ...app, ...values } : app,
      ),
    });

  const addApp = (app: DeviceApp = { name: "", version: "" }) =>
    patch({ apps: [...form.apps, app] });

  const removeApp = (index: number) =>
    patch({ apps: form.apps.filter((_, i) => i !== index) });

  const firmwareStatus = describeFirmware(catalog);

  const save = async () => {
    setSaving(true);
    setError(null);
    const apps = form.apps
      .map((app) => ({ name: app.name.trim(), version: app.version.trim() }))
      .filter((app) => app.name.length > 0);
    try {
      await onSubmit({
        name: form.name.trim() || undefined,
        device_type: form.deviceType,
        connectivity_type: form.connectivityType,
        firmware_version: form.firmwareVersion.trim() || undefined,
        masks: model ? [model.mask] : undefined,
        apps: apps.length > 0 ? apps : undefined,
        onboarded: form.onboarded,
      });
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader
          title={device ? "Edit device" : "Add a device"}
          description="What this device reports to apps."
          onClose={onClose}
        />
        <DialogBody scrollbarWidth="auto">
          <div className="flex flex-col gap-24">
            {error ? (
              <Banner
                appearance="error"
                title="The server rejected this device"
                description={error}
              />
            ) : null}

            <Field
              label="Model"
              hint="Sets the target id the device reports, and which Speculos emulator can back it."
            >
              <div className="flex items-center gap-12">
                <Spot
                  appearance="icon"
                  icon={model?.icon ?? LedgerDevices}
                  size={40}
                />
                <div className="min-w-0 flex-1">
                  <Select
                    value={form.deviceType}
                    items={DEVICE_MODELS.map((entry) => ({
                      value: entry.value,
                      label: entry.label,
                    }))}
                    onValueChange={(value) => {
                      const next = value ? findModel(value) : undefined;
                      if (next) pickModel(next);
                    }}
                  >
                    <SelectTrigger aria-label="Device model" />
                    <SelectContent>
                      <SelectList
                        renderItem={(item) => {
                          const entry = findModel(item.value);
                          const Icon = entry?.icon ?? LedgerDevices;
                          return (
                            <SelectItem key={item.value} value={item.value}>
                              <Icon size={20} className="text-muted" />
                              <SelectItemText>{item.label}</SelectItemText>
                            </SelectItem>
                          );
                        }}
                      />
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {model && !model.speculos ? (
                <p className="body-4 text-warning">
                  Speculos has no emulator for this model — opening an app stays
                  mocked.
                </p>
              ) : null}
            </Field>

            <TextInput
              label="Device name"
              helperText="Shown in Ledger Live and returned by GetDeviceName."
              value={form.name}
              onChange={(event) => patch({ name: event.target.value })}
            />

            <TextInput
              label="Firmware version"
              status={firmwareStatus.status}
              helperText={firmwareStatus.helperText}
              value={form.firmwareVersion}
              onChange={(event) =>
                patch({ firmwareVersion: event.target.value })
              }
            />

            <Field
              label="Connectivity"
              hint="How the app thinks it is talking to the device."
            >
              <SegmentedControl
                selectedValue={form.connectivityType}
                onSelectedChange={(connectivityType) =>
                  patch({ connectivityType })
                }
              >
                {CONNECTIVITY_TYPES.map((type) => (
                  <SegmentedControlButton key={type} value={type}>
                    {type}
                  </SegmentedControlButton>
                ))}
              </SegmentedControl>
            </Field>

            <div className="border-muted flex items-start justify-between gap-16 rounded-md border p-16">
              <div className="flex flex-col gap-2">
                <p className="body-2-semi-bold text-base">Already onboarded</p>
                <p className="body-4 text-muted">
                  Turn this off to start the device at the welcome screen and
                  walk it through Ledger Live&apos;s onboarding, step by step.
                </p>
              </div>
              <Switch
                aria-label="Already onboarded"
                selected={form.onboarded}
                onChange={(onboarded) => patch({ onboarded })}
              />
            </div>

            <Field
              label="Installed apps"
              hint="What ListApps reports, and the only apps Open App will accept. Versions come from the Manager API for the firmware above."
            >
              <div className="flex flex-col gap-8">
                <CatalogPicker
                  catalog={catalog}
                  firmware={form.firmwareVersion}
                  alreadyAdded={form.apps.map((app) => app.name)}
                  onPick={addApp}
                />
                {form.apps.map((app, index) => (
                  <div key={index} className="flex items-start gap-8">
                    <div className="min-w-0 flex-1">
                      <TextInput
                        placeholder="Name (e.g. Ethereum)"
                        value={app.name}
                        hideClearButton
                        onChange={(event) =>
                          updateApp(index, { name: event.target.value })
                        }
                      />
                    </div>
                    <div className="w-128">
                      <TextInput
                        placeholder="Version"
                        value={app.version}
                        hideClearButton
                        onChange={(event) =>
                          updateApp(index, { version: event.target.value })
                        }
                      />
                    </div>
                    <IconButton
                      appearance="no-background"
                      aria-label={`Remove app ${index + 1}`}
                      icon={Trash}
                      onClick={() => removeApp(index)}
                    />
                  </div>
                ))}
                <div>
                  <Button
                    appearance="no-background"
                    size="sm"
                    icon={Plus}
                    onClick={() => addApp()}
                  >
                    Add one by hand
                  </Button>
                </div>
              </div>
            </Field>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button appearance="no-background" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={saving} onClick={() => void save()}>
            {device ? "Save changes" : "Add device"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * What the firmware field says about the version typed into it, once the
 * debounced lookup has settled. A version that never shipped is the root cause
 * of the app list being empty, so it is called out where it can be fixed.
 */
function describeFirmware(catalog: DeviceCatalog): {
  status?: "error" | "success";
  helperText: string;
} {
  const base = "Reported by GetOsVersion, and what decides which apps exist.";
  switch (catalog.status) {
    case "loading":
      return { helperText: "Checking this OS version…" };
    case "loaded":
      return catalog.firmwareExists
        ? {
            status: "success",
            helperText: `Released for ${catalog.model}. ${base}`,
          }
        : {
            status: "error",
            helperText: `No such OS version for ${catalog.model} — Speculos will have no OS to boot.`,
          };
    default:
      return { helperText: base };
  }
}

/** Results shown at once; the rest are reached by narrowing the search. */
const MAX_RESULTS = 6;

/**
 * Picks an app from the ones that really exist for the chosen model and
 * firmware. An app's version is tied to a firmware version — Speculos looks the
 * ELF up at `/apps/{device}/{firmware}/{App}/app_{version}.elf` — so the
 * versions come from the Manager API rather than from a fixed list that would
 * be wrong the moment the firmware changed.
 *
 * Search and results are laid out inline rather than in a `Select`: its popup
 * is portaled outside the dialog, where the dialog's scroll lock swallows wheel
 * events, so a list of 200-odd apps could be clicked but never scrolled.
 */
function CatalogPicker({
  catalog,
  firmware,
  alreadyAdded,
  onPick,
}: {
  readonly catalog: DeviceCatalog;
  readonly firmware: string;
  readonly alreadyAdded: string[];
  readonly onPick: (app: DeviceApp) => void;
}) {
  const [query, setQuery] = useState("");

  if (catalog.status === "idle") {
    return (
      <p className="body-4 text-muted-subtle">
        Set a firmware version to see the apps that exist for it.
      </p>
    );
  }

  if (catalog.status === "loading") {
    return (
      <div className="flex items-center gap-8">
        <Spinner size={16} />
        <p className="body-4 text-muted">
          {`Looking up the apps for firmware ${firmware}…`}
        </p>
      </div>
    );
  }

  if (catalog.status === "error") {
    return (
      <Banner
        appearance="warning"
        title="Could not reach the app list"
        description={`${catalog.message}. Add apps by hand if you know their versions — but Speculos can only open an app whose version exists for this firmware.`}
      />
    );
  }

  // No apps at all means either the OS never shipped (already flagged on the
  // firmware field) or nothing was built for it; either way Speculos has no ELF.
  if (catalog.apps.length === 0) {
    return (
      <Banner
        appearance="warning"
        title={`No app exists for firmware ${firmware}`}
        description="Any app added by hand will fail to open under Speculos, which looks for an ELF built for this exact firmware."
      />
    );
  }

  const available = catalog.apps.filter(
    (app) => !alreadyAdded.includes(app.name),
  );

  if (available.length === 0) {
    return (
      <p className="body-4 text-muted-subtle">
        Every app available for this firmware is already installed.
      </p>
    );
  }

  // Signers first: the apps DMK has a kit for are the ones being mocked, and
  // alphabetical order would bury them behind a couple of hundred others.
  const signers = available.filter((app) => isSignerApp(app.name));
  const others = available.filter((app) => !isSignerApp(app.name));

  const needle = query.trim().toLowerCase();
  const matching = (app: DeviceApp) => app.name.toLowerCase().includes(needle);
  const matches = needle
    ? [...signers, ...others].filter(matching)
    : // With no search, every signer is offered and the rest wait behind one.
      signers;
  const shown = needle ? matches.slice(0, MAX_RESULTS) : matches;
  const hidden = needle ? matches.length - shown.length : others.length;

  return (
    <div className="flex flex-col gap-8">
      <SearchInput
        placeholder={`Search ${available.length} apps built for ${firmware}`}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onClear={() => setQuery("")}
      />
      {!needle && shown.length > 0 ? (
        <p className="body-4 text-muted">Apps DMK has a signer kit for:</p>
      ) : null}
      {shown.length === 0 ? (
        <p className="body-4 text-muted-subtle">
          {needle
            ? `No app matching "${query.trim()}" for this firmware.`
            : "No DMK signer app exists for this firmware — search for another."}
        </p>
      ) : (
        <div className="flex flex-wrap gap-6">
          {shown.map((app) => (
            <Button
              key={app.name}
              appearance="gray"
              size="sm"
              icon={Plus}
              onClick={() => onPick(app)}
            >
              {`${app.name} ${app.version}`}
            </Button>
          ))}
        </div>
      )}
      {hidden > 0 ? (
        <p className="body-4 text-muted-subtle">
          {needle
            ? `${hidden} more match — narrow the search to see them.`
            : `${hidden} other apps exist for this firmware — search to find them.`}
        </p>
      ) : null}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  readonly label: string;
  readonly hint: string;
  readonly children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6">
      <p className="body-2-semi-bold text-base">{label}</p>
      <p className="body-4 text-muted">{hint}</p>
      {children}
    </div>
  );
}
