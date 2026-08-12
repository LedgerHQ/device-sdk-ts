import {
  type GetOsVersionResponse,
  type InternalApi,
} from "@ledgerhq/device-management-kit";
import { type Either, EitherAsync, Right } from "purify-ts";

import { bestCompatibleMcu } from "@api/device-action/OsUpdate/Shared/OsUpdateUtils";
import {
  type FinalFirmware,
  type McuFirmware,
} from "@api/device-action/OsUpdate/Shared/types";
import { ResolveMcuVersionError } from "@api/device-action/OsUpdate/Update/FlashMcu/FlashMcuDeviceActionErrors";

const FORCED_MCU_VERSIONS = new Map([
  ["0.0", "0.6"],
  ["0.6", "1.5"],
  ["0.7", "1.6"],
  ["0.9", "1.7"],
]);

type ResolveMcuVersionHandlerArgs = {
  input: {
    deviceInfo: GetOsVersionResponse;
    finalFirmware: FinalFirmware;
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

export const resolveMcuVersion =
  (internalApi: InternalApi): ResolveMcuVersionHandler =>
  ({
    input: { deviceInfo, finalFirmware },
  }: ResolveMcuVersionHandlerArgs): ResolveMcuVersionHandlerResponse => {
    const forcedVersion = FORCED_MCU_VERSIONS.get(
      deviceInfo.mcuBootloaderVersion,
    );

    if (forcedVersion !== undefined) {
      return Promise.resolve(Right(forcedVersion));
    }

    return EitherAsync<ResolveMcuVersionError, string>(
      async ({ fromPromise, throwE }) => {
        const mcuList = await fromPromise(getMcuList(internalApi));
        const provider = internalApi.getManagerApiService().getProvider();
        const mcu = bestCompatibleMcu(mcuList, finalFirmware, provider);

        if (!mcu) {
          return throwE(
            new ResolveMcuVersionError(
              `No MCU firmware compatible with the final firmware ${finalFirmware.version}`,
            ),
          );
        }

        // A bootloader that is not yet at the MCU's starting point must be
        // upgraded to that bootloader version before the MCU itself can be flashed.
        return mcu.fromBootloaderVersion === deviceInfo.mcuBootloaderVersion
          ? mcu.name
          : mcu.fromBootloaderVersion;
      },
    ).run();
  };
