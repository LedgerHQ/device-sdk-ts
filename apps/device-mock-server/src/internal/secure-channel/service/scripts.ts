import { type Device } from "@ledgerhq/device-mockserver-client";

import {
  INSTALL_BLOCK_APDUS,
  SECURE_CHANNEL_GENUINE_APDU,
  SECURE_CHANNEL_GET_CERTIFICATE_APDU,
  SECURE_CHANNEL_PERMISSION_APDU,
} from "@internal/secure-channel/service/secureChannelApdus";

/**
 * The four secure-channel WebSocket endpoints exposed by the real ScriptRunner
 * (`/genuine`, `/apps/list`, `/install`, `/mcu`). `install` also backs the
 * uninstall flow (same path on the backend).
 */
export type SecureChannelEndpoint = "genuine" | "listApps" | "install" | "mcu";

/**
 * One server-driven step of a secure-channel session. `exchange` relays an APDU
 * to the device (via the client) and waits for its reply; the others are
 * terminal messages that end the session.
 */
export type SecureChannelStep =
  | { readonly type: "exchange"; readonly apdu: string }
  | {
      readonly type: "success";
      /**
       * Optional structured payload sent as the terminal `data` (only `listApps`
       * uses it, for the derived installed-app list). When omitted, the relay
       * forwards the last `exchange` reply's data as the `result` instead — so
       * the verdict/response is owned by the resolved APDU, not this script.
       */
      readonly data?: unknown;
    }
  | { readonly type: "bulk"; readonly data: string[] };

/** Installed-app entry shape consumed by DMK's `installedAppResultGuard`. */
export interface InstalledAppEntry {
  readonly flags: number;
  readonly hash: string;
  readonly hash_code_data: string;
  readonly name: string;
}

/**
 * Minimal secure-channel handshake replayed before every operation: a
 * permission request (`0xE0 0x51`) so the AllowSecureConnection interaction is
 * exercised, then a GetCertificate (`0xE0 0x52`) so a device id is emitted.
 *
 * Both APDUs are resolved by the device's APDU mock table; by default they
 * derive to success, and an explicit mock (e.g. `e051 -> 5501`) makes the
 * device reply with an error so the operation fails.
 */
const HANDSHAKE: readonly SecureChannelStep[] = [
  { type: "exchange", apdu: SECURE_CHANNEL_PERMISSION_APDU },
  { type: "exchange", apdu: SECURE_CHANNEL_GET_CERTIFICATE_APDU },
];

/**
 * Map a device's `apps` metadata to the installed-app list shape DMK expects,
 * excluding the BOLOS dashboard (which is not a regular installed app).
 */
export function deriveInstalledApps(device: Device): InstalledAppEntry[] {
  return (device.apps ?? [])
    .filter((app) => app.name.toUpperCase() !== "BOLOS")
    .map((app) => ({
      flags: 0,
      hash: app.hash ?? "",
      hash_code_data: "",
      name: app.name,
    }));
}

/**
 * Build the default scripted message sequence for an endpoint. Behaviour is
 * intentionally minimal (ADR Solution 1, "defaults + reuse mocks"): every
 * operation runs the handshake then a terminal message.
 */
export function buildSecureChannelScript(
  endpoint: SecureChannelEndpoint,
  device: Device,
): SecureChannelStep[] {
  switch (endpoint) {
    case "genuine":
      return [
        ...HANDSHAKE,
        { type: "exchange", apdu: SECURE_CHANNEL_GENUINE_APDU },
        { type: "success" },
      ];
    case "listApps":
      return [
        ...HANDSHAKE,
        { type: "success", data: deriveInstalledApps(device) },
      ];
    case "install":
      return [...HANDSHAKE, { type: "bulk", data: [...INSTALL_BLOCK_APDUS] }];
    case "mcu":
      return [...HANDSHAKE, { type: "success" }];
  }
}
