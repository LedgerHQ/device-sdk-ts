import { coerce, compare } from "semver";

import {
  type FinalFirmware,
  type McuFirmware,
} from "@api/device-action/OsUpdate/Shared/types";

const LEDGER_PROVIDER = 1;

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
): McuFirmware | null =>
  mcuList
    .filter(
      (mcu) =>
        finalFirmware.mcuVersions.includes(mcu.id) &&
        mcu.providers.includes(LEDGER_PROVIDER) &&
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
