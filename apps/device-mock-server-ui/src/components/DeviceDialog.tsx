import { type ReactNode, useEffect, useState } from "react";
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
  Spinner,
  Switch,
  TextInput,
} from "@ledgerhq/lumen-ui-react";
import { Plus, Trash } from "@ledgerhq/lumen-ui-react/symbols";

import { type CatalogApp, listCatalogApps } from "@/api/managerApi";
import { type DeviceCatalog, useDeviceCatalog } from "@/api/useDeviceCatalog";
import { useSpeculosFirmwares } from "@/api/useSpeculosFirmwares";
import { CopyButton } from "@/components/CopyButton";
import {
  CONNECTIVITY_TYPES,
  DEVICE_MODELS,
  type DeviceModel,
  findModel,
  isSignerApp,
  nextDeviceName,
} from "@/domain/devices";
import { byNewest, isPreRelease } from "@/domain/versions";

interface DeviceDialogProps {
  readonly device?: Device;
  readonly existingNames: string[];
  readonly onClose: () => void;
  readonly onSubmit: (config: DeviceConfig) => Promise<void>;
  /** Only for an existing device. */
  readonly onRemove?: () => Promise<void>;
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
    // The latest the catalogue has, filled in once it arrives.
    firmwareVersion: "",
    onboarded: true,
    apps: [],
  };
};

/**
 * An app's name in the Speculos catalogue. Speculinho strips spaces from the
 * name it looks a build up by: Ledger Live's "Bitcoin Test" is "BitcoinTest".
 */
const speculosKey = (name: string): string => name.replace(/\s/g, "");

/** App versions Speculos can boot on the chosen firmware, keyed by app. */
type SpeculosApps = Record<string, string[]>;

export function DeviceDialog({
  device,
  existingNames,
  onClose,
  onSubmit,
  onRemove,
}: DeviceDialogProps) {
  const [form, setForm] = useState<FormState>(() =>
    initialState(device, existingNames),
  );
  const [saving, setSaving] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // An edited device keeps its saved versions until its model or firmware
  // changes; from then on, as for a new one, the latest is picked.
  const [repickVersions, setRepickVersions] = useState(!device);
  const [pickLatestFirmware, setPickLatestFirmware] = useState(!device);

  const model = findModel(form.deviceType);
  const firmwares = useSpeculosFirmwares(form.deviceType);
  const catalog = useDeviceCatalog(form.deviceType, form.firmwareVersion);
  const speculosApps =
    catalog.status === "loaded" ? catalog.speculosApps : null;
  // Until the catalogue answers, a new device has no firmware to save.
  const firmwarePending = pickLatestFirmware && firmwares === undefined;

  const patch = (values: Partial<FormState>) =>
    setForm((current) => ({ ...current, ...values }));

  useEffect(() => {
    if (!pickLatestFirmware || firmwares === undefined) return;
    setPickLatestFirmware(false);
    if (firmwares) {
      setForm((current) => ({
        ...current,
        firmwareVersion: latest(firmwares),
      }));
    }
  }, [firmwares, pickLatestFirmware]);

  // A new firmware carries its own builds: move each app to its latest there.
  useEffect(() => {
    if (!speculosApps || !repickVersions) return;
    setForm((current) => {
      let changed = false;
      const apps = current.apps.map((app) => {
        const versions = speculosApps[speculosKey(app.name)];
        if (!versions || app.version === latest(versions)) return app;
        changed = true;
        return { name: app.name, version: latest(versions) };
      });
      return changed ? { ...current, apps } : current;
    });
  }, [speculosApps, repickVersions]);

  const pickModel = (next: DeviceModel) => {
    if (next.value === form.deviceType) return;
    setRepickVersions(true);
    setPickLatestFirmware(true);
    patch({
      deviceType: next.value,
      firmwareVersion: "",
      ...(device ? {} : { name: nextDeviceName(next, existingNames) }),
    });
  };

  const pickFirmware = (firmwareVersion: string) => {
    if (firmwareVersion === form.firmwareVersion) return;
    setRepickVersions(true);
    setPickLatestFirmware(false);
    patch({ firmwareVersion });
  };

  const updateApp = (index: number, values: Partial<DeviceApp>) =>
    patch({
      apps: form.apps.map((app, i) =>
        i === index ? { ...app, ...values } : app,
      ),
    });

  const addApp = (app: DeviceApp) => patch({ apps: [...form.apps, app] });

  const removeApp = (index: number) =>
    patch({ apps: form.apps.filter((_, i) => i !== index) });

  const firmwareStatus = describeFirmware(
    firmwares ?? null,
    form.firmwareVersion,
    model,
  );

  // Ledger Live resolves an installed app by its hash and its own spelling of
  // the name ("Bitcoin Test", where the catalogue has "BitcoinTest"), and skips
  // one it cannot resolve. Only the Manager API knows either.
  const forLedgerLive = (
    app: DeviceApp,
    managerApps: CatalogApp[],
  ): DeviceApp => {
    const listed = managerApps.filter(
      (entry) => speculosKey(entry.name) === speculosKey(app.name),
    );
    return {
      name: listed[0]?.name ?? app.name,
      version: app.version,
      hash:
        listed.find((entry) => entry.version === app.version)?.hash ?? app.hash,
    };
  };

  const remove = async () => {
    if (!onRemove) return;
    setSaving(true);
    setError(null);
    try {
      await onRemove();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    const firmware = form.firmwareVersion.trim();
    const named = form.apps
      .map((app) => ({
        name: app.name.trim(),
        version: app.version.trim(),
        hash: app.hash,
      }))
      .filter((app) => app.name.length > 0);
    // Without it, apps are saved as they are: what Ledger Live cannot resolve
    // still serves a DMK app.
    const managerApps =
      model && named.length > 0
        ? await listCatalogApps(model.mask, firmware, model.rcProvider).catch(
            (): CatalogApp[] => [],
          )
        : [];
    const apps = named.map((app) => forLedgerLive(app, managerApps));
    try {
      await onSubmit({
        name: form.name.trim() || undefined,
        device_type: form.deviceType,
        connectivity_type: form.connectivityType,
        firmware_version: firmware || undefined,
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

            {device ? (
              <div className="flex items-center gap-8">
                <p className="body-4 text-muted">Device id</p>
                <span className="body-4 text-base font-mono break-all">
                  {device.id}
                </span>
                <CopyButton value={device.id} label="Copy device id" />
              </div>
            ) : null}

            <Field
              label="Model"
              hint="Sets the target id the device reports, and which Speculos emulator backs it."
            >
              <div className="flex flex-wrap gap-6">
                {DEVICE_MODELS.map((entry) => (
                  <Chip
                    key={entry.value}
                    selected={entry.value === form.deviceType}
                    onClick={() => pickModel(entry)}
                  >
                    <entry.icon size={16} />
                    {entry.label}
                  </Chip>
                ))}
              </div>
              {model && !model.speculos ? (
                <p className="body-4 text-warning">
                  Speculos has no emulator for this model — opening an app stays
                  mocked.
                </p>
              ) : null}
            </Field>

            <FirmwareField
              firmwares={firmwares ?? null}
              value={form.firmwareVersion}
              status={firmwareStatus}
              onChange={pickFirmware}
            />

            <Field
              label="Installed apps"
              hint="What ListApps reports, and the only apps Open App accepts."
            >
              <AppsField
                apps={form.apps}
                catalog={catalog}
                speculosApps={speculosApps}
                onAdd={addApp}
                onUpdate={updateApp}
                onRemove={removeApp}
              />
            </Field>

            <TextInput
              label="Device name"
              helperText="Shown in Ledger Live and returned by GetDeviceName."
              value={form.name}
              onChange={(event) => patch({ name: event.target.value })}
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

            {onRemove ? (
              <div className="border-muted flex items-center gap-12 rounded-md border p-16">
                <p className="body-3 text-base flex-1">
                  {confirmingRemove
                    ? "Remove this device and its mocks?"
                    : "Remove this device from the session."}
                </p>
                {confirmingRemove ? (
                  <>
                    <Button
                      appearance="no-background"
                      size="sm"
                      disabled={saving}
                      onClick={() => setConfirmingRemove(false)}
                    >
                      Keep
                    </Button>
                    <Button
                      appearance="red"
                      size="sm"
                      loading={saving}
                      onClick={() => void remove()}
                    >
                      Remove
                    </Button>
                  </>
                ) : (
                  <Button
                    appearance="gray"
                    size="sm"
                    icon={Trash}
                    onClick={() => setConfirmingRemove(true)}
                  >
                    Remove
                  </Button>
                )}
              </div>
            ) : null}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button appearance="no-background" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={saving}
            disabled={firmwarePending || !form.firmwareVersion.trim()}
            onClick={() => void save()}
          >
            {device ? "Save changes" : "Add device"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The version targeted by default: the newest release, or the newest build
 * when there are only pre-releases.
 */
const latest = (versions: string[]): string => {
  const sorted = [...versions].sort(byNewest);
  return sorted.find((version) => !isPreRelease(version)) ?? sorted[0] ?? "";
};

interface FirmwareStatus {
  readonly status?: "error" | "success";
  readonly helperText: string;
}

function describeFirmware(
  firmwares: string[] | null,
  value: string,
  model: DeviceModel | undefined,
): FirmwareStatus {
  const base = "Reported by GetOsVersion.";
  const typed = value.trim();
  if (!firmwares || !typed || !model) return { helperText: base };
  return firmwares.includes(typed)
    ? { status: "success", helperText: `Speculos can boot it. ${base}` }
    : {
        status: "error",
        helperText: `Speculos has no ${model.label} build of it — opening an app will fail.`,
      };
}

/** Suggestions shown at once, at most. */
const MAX_SUGGESTIONS = 6;

/** Releases suggested before anything is typed. */
const RECENT_FIRMWARES = 4;

/**
 * The newest releases while the field is empty or already holds a firmware
 * Speculos has; once something else is typed, every version containing it.
 */
const firmwareSuggestions = (firmwares: string[], typed: string): string[] => {
  if (typed && !firmwares.includes(typed)) {
    return firmwares.filter((version) => version.includes(typed));
  }
  const recent = firmwares
    .filter((version) => !isPreRelease(version))
    .slice(0, RECENT_FIRMWARES);
  return typed && !recent.includes(typed) ? [typed, ...recent] : recent;
};

/**
 * Any version can be typed — a model Speculos cannot emulate, or a server
 * running as a pure mock, accepts anything — with the firmwares Speculos can
 * boot suggested under it.
 */
function FirmwareField({
  firmwares,
  value,
  status,
  onChange,
}: {
  readonly firmwares: string[] | null;
  readonly value: string;
  readonly status: FirmwareStatus;
  readonly onChange: (firmwareVersion: string) => void;
}) {
  const typed = value.trim();
  const suggestions = firmwareSuggestions(firmwares ?? [], typed);

  return (
    <div className="flex flex-col gap-8">
      <TextInput
        label="Firmware version"
        status={status.status}
        helperText={status.helperText}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {firmwares ? (
        suggestions.length === 0 ? (
          <p className="body-4 text-muted-subtle">
            {`Speculos has no firmware matching "${typed}" for this model.`}
          </p>
        ) : (
          <Suggestions
            caption={
              firmwares.includes(typed) || !typed
                ? `Type to search all ${firmwares.length}, release candidates included.`
                : undefined
            }
            hidden={suggestions.length - MAX_SUGGESTIONS}
          >
            {suggestions.slice(0, MAX_SUGGESTIONS).map((version) => (
              <Chip
                key={version}
                selected={version === typed}
                onClick={() => onChange(version)}
              >
                {version}
              </Chip>
            ))}
          </Suggestions>
        )
      ) : null}
    </div>
  );
}

/**
 * Installed apps as name and version fields, with the apps Speculos can boot
 * on this firmware suggested under the field that adds one, and each app's
 * versions under its own. Without a catalogue an app is added as typed: a pure
 * mock accepts anything.
 */
function AppsField({
  apps,
  catalog,
  speculosApps,
  onAdd,
  onUpdate,
  onRemove,
}: {
  readonly apps: DeviceApp[];
  readonly catalog: DeviceCatalog;
  readonly speculosApps: SpeculosApps | null;
  readonly onAdd: (app: DeviceApp) => void;
  readonly onUpdate: (index: number, values: Partial<DeviceApp>) => void;
  readonly onRemove: (index: number) => void;
}) {
  const [query, setQuery] = useState("");
  // The row whose version is being edited, which shows its versions.
  const [editing, setEditing] = useState<number | null>(null);

  const versionsOf = (name: string): string[] =>
    [...(speculosApps?.[speculosKey(name.trim())] ?? [])].sort(byNewest);
  const installed = apps.map((app) => speculosKey(app.name.trim()));
  const available = Object.keys(speculosApps ?? {})
    .filter((name) => !installed.includes(name))
    .sort((a, b) => a.localeCompare(b));

  const needle = query.trim().toLowerCase();
  // Spaces ignored: "bitcoin test" finds the catalogue's "BitcoinTest".
  const matches = needle
    ? available.filter((name) =>
        name.toLowerCase().includes(speculosKey(needle)),
      )
    : available.filter(isSignerApp);

  const add = (name: string) => {
    onAdd({ name, version: latest(versionsOf(name)) });
    setQuery("");
  };

  return (
    <div className="flex flex-col gap-12">
      {apps.map((app, index) => {
        const versions = versionsOf(app.name);
        const warning = speculosWarning(catalog, app);
        return (
          <div key={index} className="flex flex-col gap-6">
            <div className="flex items-start gap-8">
              <div className="min-w-0 flex-1">
                <TextInput
                  placeholder="Name (e.g. Ethereum)"
                  value={app.name}
                  hideClearButton
                  onChange={(event) =>
                    onUpdate(index, { name: event.target.value })
                  }
                />
              </div>
              <div className="w-128">
                <TextInput
                  placeholder="Version"
                  value={app.version}
                  hideClearButton
                  onFocus={() => setEditing(index)}
                  onBlur={() => setEditing(null)}
                  onChange={(event) =>
                    onUpdate(index, { version: event.target.value })
                  }
                />
              </div>
              <IconButton
                appearance="no-background"
                aria-label={`Remove app ${index + 1}`}
                icon={Trash}
                onClick={() => onRemove(index)}
              />
            </div>
            {warning ? <p className="body-4 text-warning">{warning}</p> : null}
            {versions.length > 0 && (editing === index || warning) ? (
              <Suggestions hidden={0}>
                {versions.map((version) => (
                  <Chip
                    key={version}
                    selected={version === app.version.trim()}
                    onClick={() => onUpdate(index, { version })}
                  >
                    {version}
                  </Chip>
                ))}
              </Suggestions>
            ) : null}
          </div>
        );
      })}

      <SearchInput
        placeholder={apps.length > 0 ? "Add another app" : "Add an app"}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onClear={() => setQuery("")}
      />
      {catalog.status === "loading" ? (
        <Loading text="Looking up the apps for this firmware…" />
      ) : (
        <Suggestions
          caption={
            !speculosApps
              ? needle
                ? undefined
                : "No Speculos catalogue for this device — type an app to add it as is."
              : needle
                ? matches.length === 0
                  ? `Speculos has no app matching "${query.trim()}" for this firmware.`
                  : undefined
                : available.length > 0 || apps.length > 0
                  ? `DMK signer apps. Type to search all ${available.length} Speculos has for this firmware.`
                  : "Speculos has no app for this firmware."
          }
          hidden={needle ? matches.length - MAX_SUGGESTIONS : 0}
        >
          {/* Every signer while nothing is typed; a search shows its best few. */}
          {(needle ? matches.slice(0, MAX_SUGGESTIONS) : matches).map(
            (name) => (
              <Chip key={name} onClick={() => add(name)}>
                <Plus size={16} />
                {name}
              </Chip>
            ),
          )}
          {needle && !speculosApps ? (
            <Chip
              onClick={() => {
                onAdd({ name: query.trim(), version: "" });
                setQuery("");
              }}
            >
              <Plus size={16} />
              {`Add "${query.trim()}" as typed`}
            </Chip>
          ) : null}
        </Suggestions>
      )}
    </div>
  );
}

/**
 * Why Speculos cannot open an installed app, or `null` when it can or when
 * there is no catalogue to tell.
 */
function speculosWarning(
  catalog: DeviceCatalog,
  app: DeviceApp,
): string | null {
  if (catalog.status !== "loaded" || !catalog.speculosApps) return null;
  const name = app.name.trim();
  const version = app.version.trim();
  if (!name || !version || name.toUpperCase() === "BOLOS") return null;

  const versions = catalog.speculosApps[speculosKey(name)] ?? [];
  if (versions.includes(version)) return null;
  return versions.length > 0
    ? `Speculos cannot open ${name} ${version} on this firmware.`
    : `Speculos has no build of ${name} for this firmware.`;
}

/** Chips under a field, with what did not fit counted below them. */
function Suggestions({
  caption,
  hidden,
  children,
}: {
  readonly caption?: string;
  readonly hidden: number;
  readonly children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-6">{children}</div>
      {hidden > 0 ? (
        <p className="body-4 text-muted-subtle">
          {`${hidden} more — keep typing to narrow them down.`}
        </p>
      ) : caption ? (
        <p className="body-4 text-muted-subtle">{caption}</p>
      ) : null}
    </div>
  );
}

/** A pickable value: a pill in Lumen's button colours, sized for a list. */
function Chip({
  selected,
  onClick,
  children,
}: {
  /** Absent on a chip that acts rather than selects. */
  readonly selected?: boolean;
  readonly onClick: () => void;
  readonly children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      // Leaves focus in the field the chip suggests for.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={`body-3 flex items-center gap-6 rounded-full px-12 py-6 transition-colors ${
        selected
          ? "bg-interactive text-on-interactive"
          : "bg-muted text-base hover:bg-muted-hover"
      }`}
    >
      {children}
    </button>
  );
}

function Loading({ text }: { readonly text: string }) {
  return (
    <div className="flex items-center gap-8">
      <Spinner size={16} />
      <p className="body-4 text-muted">{text}</p>
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
