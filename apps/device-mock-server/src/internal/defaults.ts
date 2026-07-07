import { type DeviceConfig } from "@ledgerhq/device-mockserver-client";

/**
 * Fallback device field values applied when a device is added without
 * specifying them.
 *
 * `device_type` is a `DeviceModelId` enum value so the transport reports the
 * right model to DMK.
 */
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
 * Status word returned when no mock matches an incoming APDU and it is not a
 * derivable handshake command.
 *
 * Note: the connection handshake (GetAppAndVersion, GetOsVersion) is no longer
 * seeded as mocks — it is derived per device from its metadata in
 * {@link file://./os/service/osApdus.ts}.
 */
export const UNKNOWN_APDU_RESPONSE = "6d00";
