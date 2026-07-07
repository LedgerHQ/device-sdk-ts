import {
  type DeviceConfig,
  type MockConfig,
  type SessionExport,
} from "@ledgerhq/device-mockserver-client";

import { type ApduExchange } from "../../hooks/useConnectorMessages";

/**
 * APDU prefixes the mock server synthesizes from device metadata when no
 * explicit mock matches (GetOsVersion, GetAppAndVersion). They are excluded by
 * default so the generated session relies on the device config for handshakes.
 */
const HANDSHAKE_PREFIXES = ["e0010000", "b0010000"];

export type GenerateSessionExportOptions = {
  /** Include the handshake APDUs (GetOsVersion / GetAppAndVersion) as mocks. */
  includeHandshake?: boolean;
};

function isHandshake(prefix: string): boolean {
  return HANDSHAKE_PREFIXES.some((handshake) => prefix.startsWith(handshake));
}

/**
 * Collapses a list of responses to a single entry when they are all identical,
 * keeping the ordered sequence otherwise (the mock server serves responses in
 * order and loops once exhausted).
 */
function dedupeResponses(responses: string[]): string[] {
  const allIdentical = responses.every((r) => r === responses[0]);
  return allIdentical ? responses.slice(0, 1) : responses;
}

function buildMocks(
  exchanges: ApduExchange[],
  includeHandshake: boolean,
): MockConfig[] {
  const responsesByPrefix = new Map<string, string[]>();

  for (const exchange of exchanges) {
    const prefix = exchange.apdu.toLowerCase();
    if (!includeHandshake && isHandshake(prefix)) {
      continue;
    }
    const responses = responsesByPrefix.get(prefix) ?? [];
    responses.push(exchange.response.toLowerCase());
    responsesByPrefix.set(prefix, responses);
  }

  return [...responsesByPrefix.entries()].map(([prefix, responses]) => ({
    prefix,
    responses: dedupeResponses(responses),
  }));
}

/**
 * A device and the APDU exchanges captured from it, used to build one entry of
 * the session export.
 */
export type DeviceCaptureGroup = {
  device: Partial<DeviceConfig>;
  exchanges: ApduExchange[];
};

/**
 * Builds a single device config (metadata + derived mocks).
 */
function buildDeviceConfig(
  device: Partial<DeviceConfig>,
  exchanges: ApduExchange[],
  includeHandshake: boolean,
): Partial<DeviceConfig> {
  const mocks = buildMocks(exchanges, includeHandshake);
  const { name, ...rest } = device;
  return {
    ...(name !== undefined ? { name } : {}),
    ...rest,
    mocks,
  };
}

/**
 * Derives a mock-server session export from captured APDU exchanges.
 *
 * Each unique request APDU becomes a mock whose `prefix` is the full request
 * hex (so the server matches it exactly), and whose `responses` replay the
 * captured responses in order.
 *
 * @param exchanges Captured APDU exchanges.
 * @param device Device metadata to attach (name, device_type, firmware...).
 * @param options Generation options.
 */
export function generateSessionExport(
  exchanges: ApduExchange[],
  device: Partial<DeviceConfig> = {},
  options: GenerateSessionExportOptions = {},
): SessionExport {
  return {
    devices: [
      buildDeviceConfig(device, exchanges, options.includeHandshake ?? false),
    ],
  };
}

/**
 * Derives a mock-server session export from several devices, each with its own
 * captured exchanges. Used when more than one device was active during the
 * recording so each gets a distinct entry instead of being merged together.
 *
 * @param groups One device + its exchanges per connected device.
 * @param options Generation options.
 */
export function generateMultiDeviceSessionExport(
  groups: DeviceCaptureGroup[],
  options: GenerateSessionExportOptions = {},
): SessionExport {
  const includeHandshake = options.includeHandshake ?? false;
  return {
    devices: groups.map(({ device, exchanges }) =>
      buildDeviceConfig(device, exchanges, includeHandshake),
    ),
  };
}
