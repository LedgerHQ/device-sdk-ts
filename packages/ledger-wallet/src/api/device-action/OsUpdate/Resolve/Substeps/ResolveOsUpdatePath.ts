import {
  type GetOsVersionResponse,
  type InternalApi,
} from "@ledgerhq/device-management-kit";
import { type Either, EitherAsync, Just, Maybe } from "purify-ts";
import { coerce, compare } from "semver";

import { ResolveOsUpdatePathError } from "@api/device-action/OsUpdate/Resolve/ResolveOsUpdatePathDeviceActionErrors";
import {
  type FinalFirmware,
  type McuFirmware,
  type OsuFirmware,
  type OsUpdate,
} from "@api/device-action/OsUpdate/Resolve/types";

type ResolveOsUpdatePathHandlerInput = {
  getOsVersionResponse: GetOsVersionResponse;
};

type ResolveOsUpdatePathHandlerResponse = Promise<
  Either<ResolveOsUpdatePathError, OsUpdate[]>
>;

type ResolveOsUpdatePathHandler = ({
  input,
}: {
  input: ResolveOsUpdatePathHandlerInput;
}) => ResolveOsUpdatePathHandlerResponse;

type DeviceVersion = {
  id: number;
};

/**
 * Limit the number of OS updates to 5 to avoid infinite loops.
 * In practice, it should never be more than that.
 */
const MAX_OS_UPDATES_LIMIT = 5;

export const resolveOsUpdatePath =
  (internalApi: InternalApi): ResolveOsUpdatePathHandler =>
  ({ input: { getOsVersionResponse } }): ResolveOsUpdatePathHandlerResponse =>
    EitherAsync<ResolveOsUpdatePathError, OsUpdate[]>(
      async ({ liftEither, fromPromise }) => {
        const mcuList = await fromPromise(getMcuList(internalApi));
        let mcuId = await liftEither(
          resolveMcuId(mcuList, getOsVersionResponse.mcuSephVersion),
        );
        const deviceVersion = await fromPromise(
          getDeviceVersion(internalApi, getOsVersionResponse),
        );
        let osuFirmware = (
          await fromPromise(
            getOsuFirmware(internalApi, getOsVersionResponse, deviceVersion),
          )
        ).extractNullable();

        const osUpdates: OsUpdate[] = [];

        while (osuFirmware && osUpdates.length < MAX_OS_UPDATES_LIMIT) {
          const finalFirmware = await fromPromise(
            getNextFirmware(internalApi, osuFirmware),
          );
          const shouldFlashMcu = !finalFirmware.mcuVersions.includes(mcuId);

          if (shouldFlashMcu) {
            mcuId = await liftEither(
              resolveMcuId(
                mcuList,
                latestCompatibleMcuName(mcuList, finalFirmware),
              ),
            );
          }

          osUpdates.push({ osuFirmware, finalFirmware, shouldFlashMcu });

          osuFirmware = (
            await fromPromise(
              getNextOsuFirmware(internalApi, deviceVersion, finalFirmware),
            )
          ).extractNullable();
        }

        return osUpdates;
      },
    ).run();

const toResolveOsUpdatePathError = (error: unknown): ResolveOsUpdatePathError =>
  new ResolveOsUpdatePathError(error);

const getMcuList = (
  internalApi: InternalApi,
): EitherAsync<ResolveOsUpdatePathError, McuFirmware[]> =>
  internalApi
    .getManagerApiService()
    .getMcuList()
    .map((mcuList) =>
      mcuList.map((mcu) => ({
        id: mcu.id,
        name: mcu.name,
        fromBootloaderVersion: mcu.fromBootloaderVersion,
      })),
    )
    .mapLeft(toResolveOsUpdatePathError);

const resolveMcuId = (
  mcuList: McuFirmware[],
  mcuName: string | null,
): Either<ResolveOsUpdatePathError, number> =>
  Maybe.fromNullable(mcuList.find((mcu) => mcu.name === mcuName))
    .map((mcu) => mcu.id)
    .toEither(
      new ResolveOsUpdatePathError(
        `No MCU firmware found for version ${mcuName}`,
      ),
    );

const latestCompatibleMcuName = (
  mcuList: McuFirmware[],
  finalFirmware: FinalFirmware,
): string | null =>
  mcuList
    .filter((mcu) => finalFirmware.mcuVersions.includes(mcu.id))
    .reduce<{ name: string; version: string } | null>((latestMcu, mcu) => {
      const version = coerce(mcu.name)?.version;

      if (!version) {
        return latestMcu;
      }

      if (!latestMcu || compare(version, latestMcu.version) > 0) {
        return { name: mcu.name, version };
      }

      return latestMcu;
    }, null)?.name ?? null;

const getDeviceVersion = (
  internalApi: InternalApi,
  getOsVersionResponse: GetOsVersionResponse,
): EitherAsync<ResolveOsUpdatePathError, DeviceVersion> => {
  const managerApi = internalApi.getManagerApiService();
  return managerApi
    .getDeviceVersion(getOsVersionResponse)
    .mapLeft(toResolveOsUpdatePathError);
};

const getOsuFirmware = (
  internalApi: InternalApi,
  getOsVersionResponse: GetOsVersionResponse,
  deviceVersion: DeviceVersion,
): EitherAsync<ResolveOsUpdatePathError, Maybe<OsuFirmware>> => {
  const managerApi = internalApi.getManagerApiService();
  return getOsVersionResponse.isOsu
    ? managerApi
        .getOsuFirmwareVersion(getOsVersionResponse, deviceVersion)
        .map(Just)
        .mapLeft(toResolveOsUpdatePathError)
    : managerApi
        .getFirmwareVersion(getOsVersionResponse, deviceVersion)
        .chain((firmwareVersion) =>
          managerApi.getLatestFirmwareVersion(firmwareVersion, deviceVersion),
        )
        .mapLeft(toResolveOsUpdatePathError);
};

const getNextFirmware = (
  internalApi: InternalApi,
  osuFirmware: OsuFirmware,
): EitherAsync<ResolveOsUpdatePathError, FinalFirmware> =>
  internalApi
    .getManagerApiService()
    .getNextFirmwareVersion(osuFirmware)
    .map((nextFirmware) => ({
      id: nextFirmware.id,
      perso: nextFirmware.perso,
      version: nextFirmware.version,
      bytes: nextFirmware.bytes,
      firmware: nextFirmware.firmware,
      firmwareKey: nextFirmware.firmwareKey,
      hash: nextFirmware.hash,
      mcuVersions: nextFirmware.mcuVersions,
    }))
    .mapLeft(toResolveOsUpdatePathError);

const getNextOsuFirmware = (
  internalApi: InternalApi,
  deviceVersion: DeviceVersion,
  finalFirmware: FinalFirmware,
): EitherAsync<ResolveOsUpdatePathError, Maybe<OsuFirmware>> => {
  const managerApi = internalApi.getManagerApiService();
  return managerApi
    .getLatestFirmwareVersion(finalFirmware, deviceVersion)
    .mapLeft(toResolveOsUpdatePathError);
};
