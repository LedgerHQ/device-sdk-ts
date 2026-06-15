import { randomUUID } from "node:crypto";

/**
 * Helpers for the Speculos proxy: detecting the *Open App* / *Close App* APDUs,
 * and translating the mock device metadata into the parameters the Speculinho
 * operator expects on `/acquire`.
 */

/** Open App command class/instruction (`e0 d8 00 00 <len> <ascii name>`). */
export const OPEN_APP_CLA = 0xe0;
export const OPEN_APP_INS = 0xd8;
/** Close App command prefix (`b0 a7 00 00`). */
export const CLOSE_APP_PREFIX = "b0a7";

/** Status word returned by the open-app interception path. */
export const SW_OK = "9000";
/** "Unknown application name" — app is not installed on the device. */
export const SW_UNKNOWN_APP = "6807";
/** Generic failure (misconfigured device, unreachable Speculos, ...). */
export const SW_PROXY_ERROR = "6d00";

/**
 * Map a DMK `device_type` (DeviceModelId enum value) to the Speculinho `device`
 * model identifier. Returns `null` for models Speculos does not support.
 */
const DEVICE_MODEL_BY_TYPE: Record<string, string> = {
  nanos: "nanos",
  nanosp: "nanosp",
  nanox: "nanox",
  stax: "stax",
  flex: "flex",
};

/**
 * Parse an *Open App* APDU and return the requested application name, or `null`
 * when the APDU is not a well-formed open-app command.
 */
export function parseOpenApp(apduHex: string): string | null {
  const hex = apduHex.toLowerCase().replace(/^0x/, "");
  // Need at least the 5-byte header (cla, ins, p1, p2, len).
  if (hex.length < 10 || hex.length % 2 !== 0) return null;
  const cla = parseInt(hex.slice(0, 2), 16);
  const ins = parseInt(hex.slice(2, 4), 16);
  if (cla !== OPEN_APP_CLA || ins !== OPEN_APP_INS) return null;
  const len = parseInt(hex.slice(8, 10), 16);
  const data = hex.slice(10, 10 + len * 2);
  if (data.length < len * 2) return null;
  let name = "";
  for (let i = 0; i < data.length; i += 2) {
    name += String.fromCharCode(parseInt(data.slice(i, i + 2), 16));
  }
  return name;
}

/**
 * Resolve the Speculinho `coin_app` for a BOLOS application name.
 *
 * Speculinho builds the ELF path as
 * `/apps/{device}/{os}/{coin_app}/app_{version}.elf`, where `{coin_app}` is the
 * coin-apps directory name — which is the BOLOS app name itself (e.g.
 * "Ethereum", not "eth"). The operator strips spaces for the ELF path, so the
 * name is passed through verbatim (trimmed).
 */
export function mapCoinApp(appName: string): string {
  return appName.trim();
}

/** Resolve the Speculinho `device` model id, or `null` if unsupported. */
export function mapDeviceModel(deviceType: string): string | null {
  return DEVICE_MODEL_BY_TYPE[deviceType.toLowerCase()] ?? null;
}

/**
 * Build a DNS-1123 compliant `run_id`
 * (`^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$`) for a proxy acquire, derived from the
 * coin app and device model so it stays readable in operator logs / dashboards.
 */
export function buildRunId(coinApp: string, model: string): string {
  return sanitizeDns1123(
    `mock-${randomUUID().slice(0, 8)}-${coinApp}-${model}`,
  );
}

function sanitizeDns1123(value: string): string {
  const sanitized = value
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63)
    .replace(/-+$/, "");
  return sanitized.length > 0 ? sanitized : "mock";
}
