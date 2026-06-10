import { DeviceModelId } from "@ledgerhq/device-management-kit";

/**
 * Parse a comma-separated response input into an ordered list of APDU
 * responses. A single value yields a one-entry sequence.
 */
export const parseResponses = (value: string): string[] =>
  value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

export type Option = { label: string; value: string };

/** Fixed device model choices (matches the SpeculosDeviceModel setting). */
export const deviceTypeOptions: Option[] = [
  { label: "Nano S", value: DeviceModelId.NANO_S },
  { label: "Nano S Plus", value: DeviceModelId.NANO_SP },
  { label: "Nano X", value: DeviceModelId.NANO_X },
  { label: "Stax", value: DeviceModelId.STAX },
  { label: "Flex", value: DeviceModelId.FLEX },
  { label: "Apex", value: DeviceModelId.APEX },
];

/** Fixed connectivity choices supported by the mock transport. */
export const connectivityTypeOptions: Option[] = [
  { label: "USB", value: "USB" },
  { label: "BLE", value: "BLE" },
];
