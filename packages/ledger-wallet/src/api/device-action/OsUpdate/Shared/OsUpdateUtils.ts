import { coerce, compare } from "semver";

import {
  type FinalFirmware,
  type McuFirmware,
} from "@api/device-action/OsUpdate/Shared/types";

const DEFAULT_MANAGER_API_PROVIDER = 1;

/*
 * List of from_bootloader_versions that are excluded.
 */
const EXCLUDED_FROM_BOOTLOADER_VERSIONS = new Set([
  "none",
  "noneee",
  "rien",
  "",
]);

/*
 * The MCU catalog and the devices do not agree on how many segments a
 * bootloader version has ("1.16" against "1.16.0"), so compare them coerced and
 * only fall back to the raw strings when either side is not valid semver.
 */
export const isSameBootloaderVersion = (
  bootloaderVersion: string,
  otherBootloaderVersion: string,
): boolean => {
  const coerced = coerce(bootloaderVersion)?.version;
  const otherCoerced = coerce(otherBootloaderVersion)?.version;

  return coerced !== undefined && otherCoerced !== undefined
    ? coerced === otherCoerced
    : bootloaderVersion === otherBootloaderVersion;
};

const highestMcu = (mcuList: McuFirmware[]): McuFirmware | null =>
  mcuList.reduce<(McuFirmware & { version: string }) | null>(
    (latestMcu, mcu) => {
      const version = coerce(mcu.name)?.version;

      if (!version) {
        return latestMcu;
      }

      if (!latestMcu || compare(version, latestMcu.version) > 0) {
        return {
          ...mcu,
          version,
        };
      }

      return latestMcu;
    },
    null,
  );

export const bestCompatibleMcu = (
  mcuList: McuFirmware[],
  finalFirmware: FinalFirmware,
  provider: number = DEFAULT_MANAGER_API_PROVIDER,
): McuFirmware | null =>
  highestMcu(
    mcuList.filter(
      (mcu) =>
        finalFirmware.mcuVersions.includes(mcu.id) &&
        mcu.providers.includes(provider) &&
        !EXCLUDED_FROM_BOOTLOADER_VERSIONS.has(mcu.fromBootloaderVersion),
    ),
  );

/*
 * Fallback for devices that report no secure element firmware: without a final
 * firmware to aim at, the only usable hint is the bootloader they start from.
 */
export const bestMcuForBootloaderVersion = (
  mcuList: McuFirmware[],
  bootloaderVersion: string,
  provider: number = DEFAULT_MANAGER_API_PROVIDER,
): McuFirmware | null =>
  highestMcu(
    mcuList.filter(
      (mcu) =>
        mcu.providers.includes(provider) &&
        !EXCLUDED_FROM_BOOTLOADER_VERSIONS.has(mcu.fromBootloaderVersion) &&
        isSameBootloaderVersion(mcu.fromBootloaderVersion, bootloaderVersion),
    ),
  );
