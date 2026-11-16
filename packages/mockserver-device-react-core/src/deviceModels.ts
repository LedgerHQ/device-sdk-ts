export interface DeviceScreenModel {
  readonly label: string;
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
    touch: true,
    speculos: true,
    screenWidth: 400,
    screenHeight: 672,
    lightScreen: true,
  },
  flex: {
    label: "Flex",
    touch: true,
    speculos: true,
    screenWidth: 480,
    screenHeight: 600,
    lightScreen: true,
  },
  apexp: {
    label: "Apex",
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
