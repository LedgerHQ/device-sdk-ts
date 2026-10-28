import {
  type GetOsVersionResponse,
  type InternalApi,
} from "@ledgerhq/device-management-kit";
import { type Either, EitherAsync, Just, Maybe } from "purify-ts";
import { maxSatisfying } from "semver";

import { ResolveOsUpdatePathError } from "@api/device-action/OsUpdate/Resolve/ResolveOsUpdatePathDeviceActionErrors";
import {
  type FinalFirmware,
  type McuFirmware,
  type OsuFirmware,
  type OsUpdate,
} from "@api/device-action/OsUpdate/Resolve/types";

export type ResolveOsUpdatePathHanderInput = {
  getOsVersionResponse: GetOsVersionResponse;
};

export type ResolveOsUpdatePathHandlerResponse = Promise<
  Either<ResolveOsUpdatePathError, OsUpdate[]>
>;

export type ResolveOsUpdatePathHandler = ({
  input,
}: {
  input: ResolveOsUpdatePathHanderInput;
}) => ResolveOsUpdatePathHandlerResponse;

export const resolveOsUpdatePath =
  (internalApi: InternalApi): ResolveOsUpdatePathHandler =>
  ({ input: { getOsVersionResponse } }): ResolveOsUpdatePathHandlerResponse =>
    EitherAsync<ResolveOsUpdatePathError, OsUpdate[]>(
      async ({ liftEither, fromPromise }) => {
        const mcuList = await fromPromise(getMcuList(internalApi));
        let mcuId = await liftEither(
          resolveMcuId(mcuList, getOsVersionResponse.mcuSephVersion),
        );
        let osuFirmware = (
          await fromPromise(getOsuFirmware(internalApi, getOsVersionResponse))
        ).extractNullable();

        const osUpdates: OsUpdate[] = [];

        while (osuFirmware) {
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
              getNextOsuFirmware(
                internalApi,
                getOsVersionResponse,
                finalFirmware,
              ),
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
  maxSatisfying(
    mcuList
      .filter((mcu) => finalFirmware.mcuVersions.includes(mcu.id))
      .map((mcu) => mcu.name),
    "*",
  );

const getOsuFirmware = (
  internalApi: InternalApi,
  getOsVersionResponse: GetOsVersionResponse,
): EitherAsync<ResolveOsUpdatePathError, Maybe<OsuFirmware>> => {
  const managerApi = internalApi.getManagerApiService();
  return managerApi
    .getDeviceVersion(getOsVersionResponse)
    .chain((deviceVersion) =>
      getOsVersionResponse.isOsu
        ? managerApi
            .getOsuFirmwareVersion(getOsVersionResponse, deviceVersion)
            .map(Just)
        : managerApi
            .getFirmwareVersion(getOsVersionResponse, deviceVersion)
            .chain((firmwareVersion) =>
              managerApi.getLatestFirmwareVersion(
                firmwareVersion,
                deviceVersion,
              ),
            ),
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
  getOsVersionResponse: GetOsVersionResponse,
  finalFirmware: FinalFirmware,
): EitherAsync<ResolveOsUpdatePathError, Maybe<OsuFirmware>> => {
  const managerApi = internalApi.getManagerApiService();
  return managerApi
    .getDeviceVersion(getOsVersionResponse)
    .chain((deviceVersion) =>
      managerApi.getLatestFirmwareVersion(finalFirmware, deviceVersion),
    )
    .mapLeft(toResolveOsUpdatePathError);
};
