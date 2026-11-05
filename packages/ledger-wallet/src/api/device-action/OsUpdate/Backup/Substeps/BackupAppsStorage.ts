import {
  getLogger,
  type InstalledApp,
  type InternalApi,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { type Either, Left, Right } from "purify-ts";

import { BackupAppsStorageError } from "@api/device-action/OsUpdate/Backup/CreateBackupDeviceActionErrors";
import { type BackupApp } from "@api/device-action/OsUpdate/Backup/types";
import { BackupAppStorageTask } from "@api/task/OsUpdate/Backup/BackupAppStorageTask";

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
  (internalApi: InternalApi): BackupAppsStorageHandler =>
  async ({
    input,
  }: BackupAppsStorageHandlerArgs): BackupAppsStorageHandlerResponse => {
    const { installedApps } = input;
    const logger = getLogger("BackupAppStorageTask");
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
