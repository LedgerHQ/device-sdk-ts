import {
  BackupAppStorageTask,
  type InstalledApp,
  type InternalApi,
  isSuccessCommandResult,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import { type Either, Left, Right } from "purify-ts";

import { BackupAppsStorageError } from "@api/device-action/OsUpdate/Backup/CreateBackupDeviceActionErrors";
import { type BackupApp } from "@api/device-action/OsUpdate/Backup/types";

const EMPTY_STORAGE = "0x";

type BackupAppsStorageHandlerArgs = {
  input: { installedApps: InstalledApp[] };
};

type BackupAppsStorageHandlerResponse = Promise<
  Either<BackupAppsStorageError, BackupApp[]>
>;

type BackupAppsStorageHandler = (
  args: BackupAppsStorageHandlerArgs,
) => BackupAppsStorageHandlerResponse;

export const backupAppsStorage =
  (
    internalApi: InternalApi,
    loggerFactory: (tag: string) => LoggerPublisherService,
  ): BackupAppsStorageHandler =>
  async ({
    input,
  }: BackupAppsStorageHandlerArgs): BackupAppsStorageHandlerResponse => {
    const { installedApps } = input;
    const logger = loggerFactory("BackupAppStorageTask");
    const backupApps: BackupApp[] = [];
    for (const installedApp of installedApps) {
      const backupAppStorageTaskResponse = await new BackupAppStorageTask(
        {
          appName: installedApp.name,
        },
        internalApi,
        logger,
      ).run();

      if (!isSuccessCommandResult(backupAppStorageTaskResponse)) {
        return Left(
          new BackupAppsStorageError(
            backupAppStorageTaskResponse.error.originalError,
          ),
        );
      }

      backupApps.push({
        appName: installedApp.name,
        data:
          backupAppStorageTaskResponse.data.appStorageData === EMPTY_STORAGE
            ? undefined
            : backupAppStorageTaskResponse.data.appStorageData,
      });
    }

    return Right(backupApps);
  };
