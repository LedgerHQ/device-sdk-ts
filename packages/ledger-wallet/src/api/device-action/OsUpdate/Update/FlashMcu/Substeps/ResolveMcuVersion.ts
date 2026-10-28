import {
  type GetOsVersionResponse,
  type InternalApi,
} from "@ledgerhq/device-management-kit";
import { type Either, EitherAsync, Right } from "purify-ts";

import {
  bestCompatibleMcu,
  bestMcuForBootloaderVersion,
  isSameBootloaderVersion,
} from "@api/device-action/OsUpdate/Shared/OsUpdateUtils";
import {
  type FinalFirmware,
  type McuFirmware,
} from "@api/device-action/OsUpdate/Shared/types";
import { ResolveMcuVersionError } from "@api/device-action/OsUpdate/Update/FlashMcu/FlashMcuDeviceActionErrors";
import { type FlashMcuDAInput } from "@api/device-action/OsUpdate/Update/FlashMcu/types";

/*
 * An OS update aims at a known firmware, so the MCU catalog can answer on its
 * own and the only bootloader it cannot answer for is one old enough to report
 * no version at all. A recovery has no firmware to constrain the catalog with,
 * so it also needs the hops that predate it.
 */
const OS_UPDATE_FORCED_MCU_VERSIONS = new Map([["0.0", "0.6"]]);

const BOOTLOADER_RECOVERY_FORCED_MCU_VERSIONS = new Map([
  ["0.0", "0.6"],
  ["0.6", "1.5"],
  ["0.7", "1.6"],
  ["0.9", "1.7"],
]);

const forcedMcuVersions = (
  mode: FlashMcuDAInput["mode"],
): Map<string, string> => {
  switch (mode) {
    case "osUpdate":
      return OS_UPDATE_FORCED_MCU_VERSIONS;
    case "bootloaderRecovery":
      return BOOTLOADER_RECOVERY_FORCED_MCU_VERSIONS;
    default: {
      const exhaustiveCheck: never = mode;
      return exhaustiveCheck;
    }
  }
};

type ResolveMcuVersionHandlerArgs = {
  input: FlashMcuDAInput & {
    deviceInfo: GetOsVersionResponse;
  };
};

type ResolveMcuVersionHandlerResponse = Promise<
  Either<ResolveMcuVersionError, string>
>;

type ResolveMcuVersionHandler = (
  args: ResolveMcuVersionHandlerArgs,
) => ResolveMcuVersionHandlerResponse;

const toResolveMcuVersionError = (error: unknown): ResolveMcuVersionError =>
  new ResolveMcuVersionError(error);

const getMcuList = (
  internalApi: InternalApi,
): EitherAsync<ResolveMcuVersionError, McuFirmware[]> =>
  internalApi
    .getManagerApiService()
    .getMcuList()
    .map((mcuList) =>
      mcuList.map((mcu) => ({
        id: mcu.id,
        name: mcu.name,
        fromBootloaderVersion: mcu.fromBootloaderVersion,
        providers: mcu.providers,
      })),
    )
    .mapLeft(toResolveMcuVersionError);

/*
 * The hop table is keyed on major.minor, while devices report anything from
 * "0.0.0" (bootloaders old enough to have no version field) to "1.16".
 */
const bootloaderMajorMinor = (bootloaderVersion: string): string =>
  bootloaderVersion.split(".").slice(0, 2).join(".");

/*
 * A device in bootloader mode reports the MCU in `targetId`, but the catalog
 * lookups are about the secure element: both the device version and the
 * firmware version (which is read from `seVersion`) have to be resolved for the
 * SE target instead.
 */
const getSecureElementFinalFirmware = (
  internalApi: InternalApi,
  deviceInfo: GetOsVersionResponse,
  seTargetId: number,
): EitherAsync<ResolveMcuVersionError, FinalFirmware> => {
  const managerApiService = internalApi.getManagerApiService();
  const secureElementDeviceInfo = { ...deviceInfo, targetId: seTargetId };

  return managerApiService
    .getDeviceVersion(secureElementDeviceInfo)
    .chain((deviceVersion) =>
      managerApiService.getFirmwareVersion(
        secureElementDeviceInfo,
        deviceVersion,
      ),
    )
    .map((finalFirmware) => ({
      id: finalFirmware.id,
      perso: finalFirmware.perso,
      version: finalFirmware.version,
      bytes: finalFirmware.bytes,
      firmware: finalFirmware.firmware,
      firmwareKey: finalFirmware.firmwareKey,
      hash: finalFirmware.hash,
      mcuVersions: finalFirmware.mcuVersions,
    }))
    .mapLeft(toResolveMcuVersionError);
};

/*
 * Returns null when there is no firmware to aim at, which only happens on a
 * device whose bootloader reports no secure element version.
 */
const getFinalFirmware = (
  internalApi: InternalApi,
  input: ResolveMcuVersionHandlerArgs["input"],
): EitherAsync<ResolveMcuVersionError, FinalFirmware | null> => {
  switch (input.mode) {
    case "osUpdate":
      return EitherAsync.liftEither(Right(input.finalFirmware));
    case "bootloaderRecovery": {
      const { seVersion, seTargetId } = input.deviceInfo;

      return seVersion !== "" && seTargetId !== undefined
        ? getSecureElementFinalFirmware(
            internalApi,
            input.deviceInfo,
            seTargetId,
          )
        : EitherAsync.liftEither(Right(null));
    }
    default: {
      const exhaustiveCheck: never = input;
      return exhaustiveCheck;
    }
  }
};

export const resolveMcuVersion =
  (internalApi: InternalApi): ResolveMcuVersionHandler =>
  ({
    input,
  }: ResolveMcuVersionHandlerArgs): ResolveMcuVersionHandlerResponse => {
    const { deviceInfo } = input;
    const forcedVersion = forcedMcuVersions(input.mode).get(
      bootloaderMajorMinor(deviceInfo.mcuBootloaderVersion),
    );

    if (forcedVersion !== undefined) {
      return Promise.resolve(Right(forcedVersion));
    }

    return EitherAsync<ResolveMcuVersionError, string>(
      async ({ fromPromise, throwE }) => {
        const mcuList = await fromPromise(getMcuList(internalApi));
        const provider = internalApi.getManagerApiService().getProvider();
        const finalFirmware = await fromPromise(
          getFinalFirmware(internalApi, input),
        );
        const mcu = finalFirmware
          ? bestCompatibleMcu(mcuList, finalFirmware, provider)
          : bestMcuForBootloaderVersion(
              mcuList,
              deviceInfo.mcuBootloaderVersion,
              provider,
            );

        if (!mcu) {
          return throwE(
            new ResolveMcuVersionError(
              finalFirmware
                ? `No MCU firmware compatible with the final firmware ${finalFirmware.version}`
                : `No MCU firmware compatible with the bootloader version ${deviceInfo.mcuBootloaderVersion}`,
            ),
          );
        }

        // A bootloader that is not yet at the MCU's starting point must be
        // upgraded to that bootloader version before the MCU itself can be flashed.
        return isSameBootloaderVersion(
          mcu.fromBootloaderVersion,
          deviceInfo.mcuBootloaderVersion,
        )
          ? mcu.name
          : mcu.fromBootloaderVersion;
      },
    ).run();
  };
