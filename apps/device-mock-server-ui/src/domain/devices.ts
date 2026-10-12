import { Apex, Flex, Nano, Stax } from "@ledgerhq/lumen-ui-react/symbols";

/**
 * For Speculos proxying, firmware and app versions must be in Speculinho's
 * catalogue, which the device dialog offers. Pure mock sessions accept any
 * value.
 */
export interface DeviceModel {
  /** `device_type` sent to the server (a DMK `DeviceModelId` value). */
  readonly value: string;
  readonly label: string;
  readonly defaultName: string;
  readonly mask: number;
  readonly icon: typeof Nano;
  /** Whether Speculinho can start a real Speculos emulator for this model. */
  readonly speculos: boolean;
  /**
   * Provider carrying this model's release-candidate firmwares, absent for a
   * model that no longer gets any.
   */
  readonly rcProvider?: number;
}

export const DEVICE_MODELS: DeviceModel[] = [
  {
    value: "nanoS",
    label: "Nano S",
    defaultName: "Ledger Nano S",
    mask: 0x31100000,
    icon: Nano,
    speculos: false,
  },
  {
    value: "nanoSP",
    label: "Nano S Plus",
    defaultName: "Ledger Nano S Plus",
    mask: 0x33100000,
    icon: Nano,
    speculos: true,
    rcProvider: 81,
  },
  {
    value: "nanoX",
    label: "Nano X",
    defaultName: "Ledger Nano X",
    mask: 0x33000000,
    icon: Nano,
    speculos: true,
    rcProvider: 80,
  },
  {
    value: "stax",
    label: "Stax",
    defaultName: "Ledger Stax",
    mask: 0x33200000,
    icon: Stax,
    speculos: true,
    rcProvider: 83,
  },
  {
    value: "flex",
    label: "Flex",
    defaultName: "Ledger Flex",
    mask: 0x33300000,
    icon: Flex,
    speculos: true,
    rcProvider: 82,
  },
  {
    value: "apexp",
    label: "Apex",
    defaultName: "Ledger Apex",
    mask: 0x33400000,
    icon: Apex,
    speculos: true,
    rcProvider: 84,
  },
];

export const findModel = (deviceType: string): DeviceModel | undefined =>
  DEVICE_MODELS.find((model) => model.value === deviceType);

export const CONNECTIVITY_TYPES = ["USB", "BLE"] as const;

/**
 * App names DMK ships a signer kit for (`packages/signer/*`), offered ahead of
 * the few hundred others. Spelled as the Manager API reports them, which is
 * also what Open App expects — note `InternetComputer` has no space.
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

export const nextDeviceName = (
  model: DeviceModel,
  existingNames: string[],
): string => {
  if (!existingNames.includes(model.defaultName)) return model.defaultName;
  let index = 2;
  while (existingNames.includes(`${model.defaultName} ${index}`)) index += 1;
  return `${model.defaultName} ${index}`;
};
