import { type Device } from "@ledgerhq/device-mockserver-client";

/**
 * Synthesizes the OS-handshake APDU responses from a device's metadata, so
 * a device connects without any seeded mock. These are produced only when no
 * explicit mock matches; an explicit per-device mock overrides them.
 *
 * The byte layouts mirror exactly what
 * `@ledgerhq/device-management-kit`'s `GetOsVersionCommand` and
 * `GetAppAndVersionCommand` parsers consume (see the matching predicates ported
 * below from `GetOsVersionCommand.ts`).
 */

/** APDU prefixes (cla+ins+p1+p2, hex) for the two handshake commands. */
export const GET_OS_VERSION_PREFIX = "e0010000";
export const GET_APP_AND_VERSION_PREFIX = "b0010000";
/** GetBatteryStatus (cla=0xe0, ins=0x10); p2 encodes {@link BatteryStatusType}. */
export const GET_BATTERY_STATUS_PREFIX = "e01000";
/** ListApps (cla=0xe0, ins=0xde) and its continue variant (ins=0xdf). */
export const LIST_APPS_PREFIX = "e0de0000";
export const LIST_APPS_CONTINUE_PREFIX = "e0df0000";
/**
 * GetDeviceName (cla=0xe0, ins=0xd2). `getDeviceName` first sends a legacy
 * "cleaning" APDU (cla=0xe0, ins=0x50) whose reply it ignores, then reads the
 * name from the 0xd2 response's data as UTF-8 (see `parseGetDeviceNameResponse`
 * in ledger-live). Both are part of the connect/listApps handshake.
 */
export const GET_DEVICE_NAME_CLEANING_PREFIX = "e0500000";
export const GET_DEVICE_NAME_PREFIX = "e0d20000";

/**
 * Custom Lock Screen commands (CLA 0xe0), matched on their cla+ins prefix. The
 * mock models a device with no lock screen image loaded (an "empty" device), so
 * read commands report empty and mutation commands succeed.
 */
export const CLS_CREATE_PREFIX = "e060"; // CreateBackgroundImage
export const CLS_UPLOAD_PREFIX = "e061"; // UploadBackgroundImageChunk
export const CLS_COMMIT_PREFIX = "e062"; // CommitBackgroundImage
export const CLS_DELETE_PREFIX = "e063"; // DeleteBackgroundImage
export const CLS_GET_SIZE_PREFIX = "e064"; // GetBackgroundImageSize
export const CLS_FETCH_CHUNK_PREFIX = "e065"; // FetchBackgroundImageChunk
export const CLS_GET_HASH_PREFIX = "e066"; // GetBackgroundImageHash

const STATUS_OK = "9000";

/** SW returned by CLS read/delete commands when no image is loaded (`662e`). */
const CLS_NO_IMAGE_SW = "662e";

/** GetBackgroundImageSize response for an empty device: size 0 + success SW. */
const CLS_EMPTY_SIZE_RESPONSE = "00000000" + STATUS_OK;

/** Upper-16-bit target-id mask per device model (lower bits are `0x0004`). */
const TARGET_ID_MASK: Record<string, number> = {
  nanos: 0x31100000,
  nanosp: 0x33100000,
  nanox: 0x33000000,
  stax: 0x33200000,
  flex: 0x33300000,
  apex: 0x33400000,
};

const normalizeModel = (deviceType: string): string => deviceType.toLowerCase();

// --- hex helpers ------------------------------------------------------------

const toHexByte = (n: number): string =>
  (n & 0xff).toString(16).padStart(2, "0");

/** Encode an ASCII string as raw bytes (no length prefix), hex. */
const asciiHex = (value: string): string => {
  let hex = "";
  for (let i = 0; i < value.length; i += 1) {
    hex += toHexByte(value.charCodeAt(i));
  }
  return hex;
};

/** Length-value encode an ASCII string: `<len><bytes>` (hex). */
const lvAscii = (value: string): string =>
  toHexByte(value.length) + asciiHex(value);

/** Length-value encode raw bytes given as a hex string. */
const lvHex = (hex: string): string => toHexByte(hex.length / 2) + hex;

/** Big-endian 32-bit unsigned int to 8 hex chars. */
const uint32Hex = (n: number): string =>
  (n >>> 0).toString(16).padStart(8, "0");

// --- semver (subset: gte on coerced "x.y.z") --------------------------------

const coerce = (version: string): [number, number, number] => {
  const match = /(\d+)(?:\.(\d+))?(?:\.(\d+))?/.exec(version);
  if (!match) return [0, 0, 0];
  return [Number(match[1] ?? 0), Number(match[2] ?? 0), Number(match[3] ?? 0)];
};

const gte = (version: string, min: string): boolean => {
  const a = coerce(version);
  const b = coerce(min);
  for (let i = 0; i < 3; i += 1) {
    if (a[i]! > b[i]!) return true;
    if (a[i]! < b[i]!) return false;
  }
  return true;
};

// --- field-support predicates (ported from GetOsVersionCommand.ts) ----------

const isBootloaderVersionSupported = (
  seVersion: string,
  model: string,
): boolean => {
  switch (model) {
    case "nanos":
    case "nanox":
      return gte(seVersion, "2.0.0");
    default:
      return true;
  }
};

const isHardwareVersionSupported = (
  seVersion: string,
  model: string,
): boolean => (model === "nanox" ? gte(seVersion, "2.0.0") : false);

const isLocalizationSupported = (seVersion: string, model: string): boolean => {
  switch (model) {
    case "nanos":
      return false;
    case "nanosp":
      return gte(seVersion, "1.1.0");
    case "nanox":
      return gte(seVersion, "2.1.0");
    default:
      return true;
  }
};

const isRecoverSupported = (seVersion: string, model: string): boolean => {
  switch (model) {
    case "nanos":
      return false;
    case "nanosp":
      return gte(seVersion, "1.1.2");
    case "nanox":
      return gte(seVersion, "2.2.3");
    case "stax":
      return gte(seVersion, "1.4.0");
    case "flex":
      return gte(seVersion, "1.0.1");
    default:
      return true;
  }
};

// --- derived responses ------------------------------------------------------

/**
 * Full target id (`<mask upper 16 bits>0004`) a device reports in GetOsVersion
 * and that the Manager API keys firmware lookups on, or `undefined` for a model
 * with no known mask and no explicit `masks` override.
 */
export function resolveTargetId(device: Device): number | undefined {
  const model = normalizeModel(device.device_type);
  const mask = device.masks?.[0] ?? TARGET_ID_MASK[model];
  if (mask === undefined) return undefined;
  return (mask & 0xffff0000) | 0x0004;
}

/**
 * GetOsVersion response derived from the device model and firmware version,
 * matching the byte layout `GetOsVersionCommand` expects in non-bootloader
 * mode. `mcuVersion` is the current MCU (`mcuSephVersion`) to advertise,
 * resolved dynamically by the caller. Returns `undefined` for an unsupported
 * model.
 */
export function deriveGetOsVersion(
  device: Device,
  mcuVersion: string,
): string | undefined {
  const model = normalizeModel(device.device_type);
  const mask = device.masks?.[0] ?? TARGET_ID_MASK[model];
  if (mask === undefined) return undefined;
  const targetId = (mask & 0xffff0000) | 0x0004;
  const seVersion = device.firmware_version ?? "0.0.0";

  let hex = uint32Hex(targetId); // targetId
  hex += lvAscii(seVersion); // seVersion
  hex += lvHex("e6000000"); // seFlags (onboarded, pin-validated, ...)
  hex += lvAscii(mcuVersion); // mcuSephVersion
  if (isBootloaderVersionSupported(seVersion, model)) {
    hex += lvAscii("1.16"); // mcuBootloaderVersion
  }
  if (isHardwareVersionSupported(seVersion, model)) {
    hex += lvHex("00"); // hwVersion
  }
  if (isLocalizationSupported(seVersion, model)) {
    hex += lvHex("00"); // langId
  }
  if (isRecoverSupported(seVersion, model)) {
    hex += lvHex("00"); // recoverState
  }
  return hex + STATUS_OK;
}

/**
 * GetAppAndVersion response at the dashboard: the running "app" is BOLOS, with
 * the device's firmware version. (An opened app is served by the Speculos proxy,
 * never this path.)
 */
export function deriveGetAppAndVersion(device: Device): string {
  const version = device.firmware_version ?? "0.0.0";
  return "01" + lvAscii("BOLOS") + lvAscii(version) + STATUS_OK;
}

/** 32-byte zero hash used as the code/full hash placeholder in ListApps. */
const ZERO_HASH_32 = "00".repeat(32);

/**
 * One ListApps entry: `<entryLen><sizeInBlocks(2)><flags(2)><codeHash(32)>`
 * `<fullHash(32)><nameLV>`, where `entryLen` counts the bytes after itself.
 * The hashes are not exercised by the parser's consumers, so they are zeroed.
 */
const listAppEntry = (name: string): string => {
  const body =
    "0001" + // appSizeInBlocks
    "0000" + // flags (skipped by the DMK parser)
    ZERO_HASH_32 + // appCodeHash
    ZERO_HASH_32 + // appFullHash
    lvAscii(name); // appName (length-value)
  return toHexByte(body.length / 2) + body;
};

/**
 * ListApps (`0xE0 0xDE`) response derived from the device's installed apps,
 * excluding the BOLOS dashboard. The leading byte is a version/format byte the
 * DMK parser skips. The continue command (`0xE0 0xDF`) and an empty list both
 * return a bare success (no entries), which DMK reads as "no more apps".
 */
export function deriveListApps(
  device: Device,
  apdu: string,
): string | undefined {
  if (apdu.startsWith(LIST_APPS_CONTINUE_PREFIX)) {
    return STATUS_OK;
  }
  if (!apdu.startsWith(LIST_APPS_PREFIX)) {
    return undefined;
  }
  const apps = (device.apps ?? []).filter(
    (app) => app.name.toUpperCase() !== "BOLOS",
  );
  if (apps.length === 0) {
    return STATUS_OK;
  }
  const entries = apps.map((app) => listAppEntry(app.name)).join("");
  return "01" + entries + STATUS_OK;
}

/**
 * GetDeviceName (`0xE0 0xD2`) response: the device name as raw UTF-8 bytes
 * followed by a success SW, mirroring what `parseGetDeviceNameResponse` reads
 * (it decodes the whole data field, no length prefix).
 */
export function deriveGetDeviceName(device: Device): string {
  return asciiHex(device.name ?? "") + STATUS_OK;
}

const BATTERY_CAPABLE_MODELS = new Set(["stax", "flex", "apex"]);

/**
 * GetBatteryStatus response for battery-capable touch devices. Unsupported models
 * return `undefined` so the resolver falls through to {@link UNKNOWN_APDU_RESPONSE}.
 */
export function deriveGetBatteryStatus(
  device: Device,
  apdu: string,
): string | undefined {
  if (!apdu.startsWith(GET_BATTERY_STATUS_PREFIX)) return undefined;
  const model = normalizeModel(device.device_type ?? "");
  if (!BATTERY_CAPABLE_MODELS.has(model)) return undefined;

  const statusType = apdu.slice(6, 8);
  switch (statusType) {
    case "00": // BatteryStatusType.BATTERY_PERCENTAGE
      return toHexByte(100) + STATUS_OK;
    default:
      return undefined;
  }
}

/**
 * Derived response for a Custom Lock Screen command (CLA 0xe0, INS 0x60..0x66),
 * modelling a device with no lock screen image loaded, or `undefined` when the
 * APDU is not one of them. Reads report the empty state (GetSize -> size 0,
 * Fetch/GetHash -> `662e` no image), mutations succeed (Create/Upload/Commit ->
 * `9000`) and Delete reports there is nothing to delete (`662e`).
 */
export function deriveCustomLockScreen(apdu: string): string | undefined {
  if (apdu.startsWith(CLS_GET_SIZE_PREFIX)) {
    return CLS_EMPTY_SIZE_RESPONSE;
  }
  if (
    apdu.startsWith(CLS_FETCH_CHUNK_PREFIX) ||
    apdu.startsWith(CLS_GET_HASH_PREFIX) ||
    apdu.startsWith(CLS_DELETE_PREFIX)
  ) {
    return CLS_NO_IMAGE_SW;
  }
  if (
    apdu.startsWith(CLS_CREATE_PREFIX) ||
    apdu.startsWith(CLS_UPLOAD_PREFIX) ||
    apdu.startsWith(CLS_COMMIT_PREFIX)
  ) {
    return STATUS_OK;
  }
  return undefined;
}

/**
 * Derived default response for an OS-handshake APDU (GetOsVersion /
 * GetAppAndVersion / GetBatteryStatus) synthesized from the device metadata, or
 * `undefined` when the APDU is not one of them (or the model is unsupported).
 * `mcuVersion` is only consumed by the GetOsVersion branch. The prefixes are
 * mutually exclusive, so the first match wins.
 */
export function deriveOsApduResponse(
  device: Device,
  apdu: string,
  mcuVersion?: string,
): string | undefined {
  if (apdu.startsWith(GET_OS_VERSION_PREFIX)) {
    return mcuVersion ? deriveGetOsVersion(device, mcuVersion) : undefined;
  }
  if (apdu.startsWith(GET_APP_AND_VERSION_PREFIX)) {
    return deriveGetAppAndVersion(device);
  }
  if (apdu.startsWith(GET_BATTERY_STATUS_PREFIX)) {
    return deriveGetBatteryStatus(device, apdu);
  }
  if (
    apdu.startsWith(LIST_APPS_PREFIX) ||
    apdu.startsWith(LIST_APPS_CONTINUE_PREFIX)
  ) {
    return deriveListApps(device, apdu);
  }
  // The legacy cleaning APDU (`0xE0 0x50`) sent before GetDeviceName: its reply
  // is ignored by the caller, so a bare success is enough to avoid a spurious
  // error status.
  if (apdu.startsWith(GET_DEVICE_NAME_CLEANING_PREFIX)) {
    return STATUS_OK;
  }
  if (apdu.startsWith(GET_DEVICE_NAME_PREFIX)) {
    return deriveGetDeviceName(device);
  }
  const cls = deriveCustomLockScreen(apdu);
  if (cls) {
    return cls;
  }
  return undefined;
}
