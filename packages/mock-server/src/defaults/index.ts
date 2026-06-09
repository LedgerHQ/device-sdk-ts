import { type DeviceConfig } from "@ledgerhq/device-mockserver-client";

/**
 * The device every freshly created session is seeded with, so the standalone
 * sample app can connect without any prior configuration.
 *
 * `device_type` is a `DeviceModelId` enum value so the transport reports the
 * right model to DMK.
 */
export const DEFAULT_DEVICE_ID = "mock-device-1";

export const DEFAULT_DEVICE: Required<
  Pick<DeviceConfig, "name" | "device_type" | "connectivity_type">
> &
  DeviceConfig = {
  name: "Ledger Nano X",
  device_type: "nanoX",
  connectivity_type: "USB",
  firmware_version: "2.2.3",
  apps: [{ name: "BOLOS", version: "1.4.0" }],
  masks: [0x33000000],
};

/**
 * Canned APDU responses seeded on session creation. They cover the connection
 * handshake DMK performs on connect (GetAppAndVersion, GetOsVersion) so a
 * device can reach the CONNECTED state out of the box.
 *
 * Keyed by APDU prefix (hex). Responses end with the two-byte status word.
 */
export const DEFAULT_MOCKS: { prefix: string; response: string }[] = [
  {
    // GetAppAndVersion (b0 01 00 00) -> BOLOS 1.4.0-rc2
    prefix: "b0010000",
    response: "0105424f4c4f5309312e342e302d7263329000",
  },
  {
    // GetOsVersion (e0 01 00 00) -> Nano X, seVersion 2.2.3
    prefix: "e0010000",
    response:
      "3300000405322e322e3304e600000004322e333004312e31360100010001009000",
  },
];

/** Status word returned when no mock matches an incoming APDU. */
export const UNKNOWN_APDU_RESPONSE = "6d00";
