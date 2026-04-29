import { EitherAsync } from "purify-ts";
import { type Either } from "purify-ts/Either";

import { LookForBackupError } from "@api/device-action/OsUpdate/Backup/BackupDeviceActionErrors";
import { type DeviceBackupStorage } from "@api/device-action/OsUpdate/Backup/Storage/DeviceBackupStorage";
import { type Backup } from "@api/device-action/OsUpdate/Backup/types";

type LookForBackupHandlerArgs = {
  input: { deviceId: string };
};

type LookForBackupHandlerResponse = Promise<
  Either<LookForBackupError, boolean>
>;

type LookForBackupHandler = (
  args: LookForBackupHandlerArgs,
) => LookForBackupHandlerResponse;

const isBackupExpired = (backup: Backup): boolean => {
  const backupAge = Date.now() - new Date(backup.createdAt).getTime();
  const ONE_DAY_IN_MS = 24 * 60 * 60 * 1000;

  return backupAge > ONE_DAY_IN_MS;
};

export const lookForBackup =
  (deviceBackupStorage: DeviceBackupStorage): LookForBackupHandler =>
  async ({ input }: LookForBackupHandlerArgs): LookForBackupHandlerResponse => {
    return EitherAsync(async ({ liftEither }) => {
      const { deviceId } = input;
      const backup = await liftEither(
        await deviceBackupStorage.getBackup(deviceId),
      );

      return backup !== null && !isBackupExpired(backup) ? true : false;
    })
      .mapLeft((error) => new LookForBackupError(error))
      .run();
  };
