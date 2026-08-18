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

export const bestCompatibleMcu = (
  mcuList: McuFirmware[],
  finalFirmware: FinalFirmware,
  provider: number = DEFAULT_MANAGER_API_PROVIDER,
): McuFirmware | null =>
  mcuList
    .filter(
      (mcu) =>
        finalFirmware.mcuVersions.includes(mcu.id) &&
        mcu.providers.includes(provider) &&
        !EXCLUDED_FROM_BOOTLOADER_VERSIONS.has(mcu.fromBootloaderVersion),
    )
    .reduce<(McuFirmware & { version: string }) | null>((latestMcu, mcu) => {
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
    }, null);
