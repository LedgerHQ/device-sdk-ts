import { type Either } from "purify-ts/Either";
import { EitherAsync } from "purify-ts/EitherAsync";

import { SaveBackupError } from "@api/device-action/OsUpdate/Backup/BackupDeviceActionErrors";
import { type DeviceBackupStorage } from "@api/device-action/OsUpdate/Backup/Storage/DeviceBackupStorage";
import { type Backup } from "@api/device-action/OsUpdate/Backup/types";

type SaveBackupHandlerArgs = {
  input: { deviceId: string; backup: Backup };
};

type SaveBackupHandlerResponse = Promise<Either<SaveBackupError, void>>;

type SaveBackupHandler = (
  args: SaveBackupHandlerArgs,
) => SaveBackupHandlerResponse;

export const saveBackup =
  (deviceBackupStorage: DeviceBackupStorage): SaveBackupHandler =>
  async ({ input }: SaveBackupHandlerArgs): SaveBackupHandlerResponse => {
    return EitherAsync(async ({ liftEither }) => {
      const { deviceId, backup } = input;
      await liftEither(await deviceBackupStorage.saveBackup(deviceId, backup));
    })
      .mapLeft((error) => new SaveBackupError(error))
      .run();
  };
