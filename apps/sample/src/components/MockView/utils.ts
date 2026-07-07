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

/** Human label for a device type value (e.g. "nanoX" -> "Nano X"). */
export const deviceTypeLabel = (deviceType: string): string =>
  deviceTypeOptions.find((option) => option.value === deviceType)?.label ??
  deviceType;

/**
 * Auto-generate a device name from its type and the existing devices, e.g.
 * "Mock Nano X 1", "Mock Nano X 2". The index is the next available slot for
 * that device type.
 */
export const nextDeviceName = (
  deviceType: string,
  existingNames: string[],
): string => {
  const base = `Mock ${deviceTypeLabel(deviceType)}`;
  let index = 1;
  while (existingNames.includes(`${base} ${index}`)) index += 1;
  return `${base} ${index}`;
};
