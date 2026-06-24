import { type Device } from "@ledgerhq/device-mockserver-client";

/**
 * Synthesizes the two OS-handshake APDU responses from a device's metadata, so
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

const STATUS_OK = "9000";

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

/** Length-value encode an ASCII string: `<len><bytes>` (hex). */
const lvAscii = (value: string): string => {
  let hex = "";
  for (let i = 0; i < value.length; i += 1) {
    hex += toHexByte(value.charCodeAt(i));
  }
  return toHexByte(value.length) + hex;
};

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
 * GetOsVersion response derived from the device model and firmware version,
 * matching the byte layout `GetOsVersionCommand` expects in non-bootloader
 * mode. Returns `undefined` for an unsupported model.
 */
export function deriveGetOsVersion(device: Device): string | undefined {
  const model = normalizeModel(device.device_type);
  const mask = device.masks?.[0] ?? TARGET_ID_MASK[model];
  if (mask === undefined) return undefined;
  const seVersion = device.firmware_version ?? "0.0.0";

  let hex = uint32Hex((mask & 0xffff0000) | 0x0004); // targetId
  hex += lvAscii(seVersion); // seVersion
  hex += lvHex("e6000000"); // seFlags (onboarded, pin-validated, ...)
  hex += lvAscii("2.30"); // mcuSephVersion
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
