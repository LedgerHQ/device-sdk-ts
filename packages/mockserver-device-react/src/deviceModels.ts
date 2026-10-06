import { Apex, Flex, Nano, Stax } from "@ledgerhq/lumen-ui-react/symbols";

export interface DeviceScreenModel {
  readonly label: string;
  readonly icon: typeof Nano;
  readonly touch: boolean;
  /** Whether Speculos has an emulator for it, so it can have a screen. */
  readonly speculos: boolean;
  /** In device pixels. */
  readonly screenWidth: number;
  readonly screenHeight: number;
  readonly lightScreen: boolean;
}

const nano = (label: string, screenHeight: number): DeviceScreenModel => ({
  label,
  icon: Nano,
  touch: false,
  speculos: true,
  screenWidth: 128,
  screenHeight,
  lightScreen: false,
});

/** Keyed by the mock server's `device_type`, a DMK `DeviceModelId`. */
const MODELS: Record<string, DeviceScreenModel> = {
  nanoS: { ...nano("Nano S", 32), speculos: false },
  nanoSP: nano("Nano S Plus", 64),
  nanoX: nano("Nano X", 64),
  stax: {
    label: "Stax",
    icon: Stax,
    touch: true,
    speculos: true,
    screenWidth: 400,
    screenHeight: 672,
    lightScreen: true,
  },
  flex: {
    label: "Flex",
    icon: Flex,
    touch: true,
    speculos: true,
    screenWidth: 480,
    screenHeight: 600,
    lightScreen: true,
  },
  apexp: {
    label: "Apex",
    icon: Apex,
    touch: true,
    speculos: true,
    screenWidth: 300,
    screenHeight: 400,
    lightScreen: true,
  },
};

const UNKNOWN: DeviceScreenModel = nano("Device", 64);

export const findDeviceScreenModel = (deviceType: string): DeviceScreenModel =>
  MODELS[deviceType] ?? UNKNOWN;
