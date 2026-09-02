import { Apex, Flex, Nano, Stax } from "@ledgerhq/lumen-ui-react/symbols";

/**
 * The device models the mock transport can report, with the firmware and memory
 * mask that go with each one.
 *
 * Firmware and app versions must exist in the coin-apps catalogue as
 * `/apps/{device}/{firmware}/{App}/app_{version}.elf` for Speculos proxying to
 * work — Speculinho builds that path verbatim when an app is opened. Pure mock
 * sessions accept any value.
 */
export interface DeviceModel {
  /** `device_type` sent to the server (a DMK `DeviceModelId` value). */
  readonly value: string;
  readonly label: string;
  readonly defaultName: string;
  readonly defaultFirmware: string;
  readonly mask: number;
  readonly icon: typeof Nano;
  /** Whether Speculinho can start a real Speculos emulator for this model. */
  readonly speculos: boolean;
}

export const DEVICE_MODELS: DeviceModel[] = [
  {
    value: "nanoS",
    label: "Nano S",
    defaultName: "Ledger Nano S",
    defaultFirmware: "2.1.0",
    mask: 0x31100000,
    icon: Nano,
    speculos: true,
  },
  {
    value: "nanoSP",
    label: "Nano S Plus",
    defaultName: "Ledger Nano S Plus",
    defaultFirmware: "1.1.1",
    mask: 0x33100000,
    icon: Nano,
    speculos: true,
  },
  {
    value: "nanoX",
    label: "Nano X",
    defaultName: "Ledger Nano X",
    defaultFirmware: "2.7.1",
    mask: 0x33000000,
    icon: Nano,
    speculos: true,
  },
  {
    value: "stax",
    label: "Stax",
    defaultName: "Ledger Stax",
    defaultFirmware: "1.10.1",
    mask: 0x33200000,
    icon: Stax,
    speculos: true,
  },
  {
    value: "flex",
    label: "Flex",
    defaultName: "Ledger Flex",
    defaultFirmware: "1.6.1",
    mask: 0x33300000,
    icon: Flex,
    speculos: true,
  },
  {
    value: "apexp",
    label: "Apex",
    defaultName: "Ledger Apex",
    defaultFirmware: "1.0.0",
    mask: 0x33400000,
    icon: Apex,
    speculos: false,
  },
];

export const findModel = (deviceType: string): DeviceModel | undefined =>
  DEVICE_MODELS.find((model) => model.value === deviceType);

export const modelLabel = (deviceType: string): string =>
  findModel(deviceType)?.label ?? deviceType;

export const CONNECTIVITY_TYPES = ["USB", "BLE"] as const;

/**
 * BOLOS app names DMK ships a signer kit for (`packages/signer/*`).
 *
 * A few hundred apps exist for a given firmware, and alphabetical order buries
 * the ones anyone mocking a device is likely to want behind "1inch" and
 * "Aeternity". These are offered first instead. Names are the app names the
 * Manager API reports, which is also what Open App expects — note
 * `InternetComputer` has no space.
 */
export const DMK_SIGNER_APPS = [
  "Aleo",
  "Bitcoin",
  "Concordium",
  "Cosmos",
  "Ethereum",
  "Hyperliquid",
  "InternetComputer",
  "Polkadot",
  "Solana",
  "Tron",
  "XRP",
  "Zcash",
];

export const isSignerApp = (appName: string): boolean =>
  DMK_SIGNER_APPS.includes(appName);

/** Auto-generated device name, e.g. "Ledger Nano X 2" for the second one. */
export const nextDeviceName = (
  model: DeviceModel,
  existingNames: string[],
): string => {
  if (!existingNames.includes(model.defaultName)) return model.defaultName;
  let index = 2;
  while (existingNames.includes(`${model.defaultName} ${index}`)) index += 1;
  return `${model.defaultName} ${index}`;
};
