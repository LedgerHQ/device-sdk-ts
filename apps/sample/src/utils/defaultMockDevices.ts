import { type DeviceConfig } from "@ledgerhq/device-mockserver-client";

/**
 * Devices seeded into a freshly provisioned mock server session, so the app
 * opens with something to connect to.
 *
 * Firmware and app versions must exist in the coin-apps catalogue as
 * `/apps/{device}/{firmware}/{App}/app_{version}.elf` — Speculinho builds that
 * path verbatim when an app is opened, and a combination it cannot find fails
 * the Open App APDU with 6d00. Check the catalogue before changing a version.
 */

/** Every signer the sample ships a view for. Identical across the three models. */
const SIGNER_APPS = [
  { name: "Aleo", version: "1.2.2" },
  { name: "Bitcoin", version: "2.5.0" },
  { name: "Cosmos", version: "2.38.19" },
  { name: "Ethereum", version: "1.22.3" },
  { name: "Hyperliquid", version: "1.0.1" },
  { name: "Polkadot", version: "100.0.27" },
  { name: "Solana", version: "1.16.0" },
  { name: "Tron", version: "0.7.6" },
  { name: "XRP", version: "2.7.0" },
  { name: "Zcash", version: "3.9.2" },
];

const device = (
  name: string,
  deviceType: string,
  firmware: string,
  mask: number,
): DeviceConfig => ({
  name,
  device_type: deviceType,
  connectivity_type: "USB",
  firmware_version: firmware,
  apps: [{ name: "BOLOS", version: firmware }, ...SIGNER_APPS],
  masks: [mask],
});

export const DEFAULT_MOCK_DEVICES: DeviceConfig[] = [
  device("Ledger Stax", "stax", "1.10.1", 0x33200000),
  device("Ledger Flex", "flex", "1.6.1", 0x33300000),
  device("Ledger Nano X", "nanoX", "2.7.1", 0x33000000),
];
