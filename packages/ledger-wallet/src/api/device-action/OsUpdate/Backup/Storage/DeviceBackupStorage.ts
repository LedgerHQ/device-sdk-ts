import {
  type DeviceId,
  DMK_STORAGE_PREFIX_KEY,
  type KeyValueStorage,
} from "@ledgerhq/device-management-kit";
import { EitherAsync } from "purify-ts";
import { type Either } from "purify-ts/Either";

import {
  deserialize,
  serialize,
} from "@api/device-action/OsUpdate/Backup/Storage/BackupSerializer";
import {
  GetBackupError,
  SaveBackupError,
} from "@api/device-action/OsUpdate/Backup/Storage/DeviceBackupStorageErrors";
import { type Backup } from "@api/device-action/OsUpdate/Backup/types";

const BACKUP_STORAGE_PREFIX_KEY = `${DMK_STORAGE_PREFIX_KEY}-device-backup`;

export class DeviceBackupStorage {
  constructor(private readonly storage: KeyValueStorage) {}

  async getBackup(
    deviceId: DeviceId,
  ): Promise<Either<GetBackupError, Backup | null>> {
    return EitherAsync(async ({ liftEither }) => {
      const data = await this.storage.getItem(
        `${BACKUP_STORAGE_PREFIX_KEY}-${deviceId}`,
      );
      if (!data) return null;
      return liftEither(deserialize(data));
    })
      .mapLeft((error) => new GetBackupError(error))
      .run();
  }

  async saveBackup(
    deviceId: DeviceId,
    backup: Backup,
  ): Promise<Either<SaveBackupError, void>> {
    return EitherAsync(async ({ liftEither }) => {
      const serialized = await liftEither(serialize(backup));
      await this.storage.setItem(
        `${BACKUP_STORAGE_PREFIX_KEY}-${deviceId}`,
        serialized,
      );
    })
      .mapLeft((error) => new SaveBackupError(error))
      .run();
  }
}
