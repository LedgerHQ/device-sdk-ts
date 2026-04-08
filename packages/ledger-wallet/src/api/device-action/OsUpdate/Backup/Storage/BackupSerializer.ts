import {
  array,
  Codec,
  type Either,
  Left,
  number,
  optional,
  Right,
  string,
} from "purify-ts";

import {
  BackupDeserializationError,
  BackupSerializationError,
} from "@api/device-action/OsUpdate/Backup/Storage/BackSerializerErrors";
import { type Backup } from "@api/device-action/OsUpdate/Backup/types";

type BackupData = Omit<Backup, "createdAt"> & { createdAt: string };

const backupCodec: Codec<BackupData> = Codec.interface({
  languageId: optional(number),
  installedApps: array(
    Codec.interface({
      appName: string,
      data: optional(string),
    }),
  ),
  clsHexImage: optional(string),
  createdAt: string,
});

export const serialize = (
  backup: Backup,
): Either<BackupSerializationError, string> => {
  try {
    return Right(JSON.stringify(backup));
  } catch (error) {
    return Left(new BackupSerializationError(error));
  }
};

export const deserialize = (
  data: string,
): Either<BackupDeserializationError, Backup> => {
  try {
    return backupCodec
      .decode(JSON.parse(data))
      .mapLeft((error) => new BackupDeserializationError(error))
      .map((backupData) => ({
        ...backupData,
        createdAt: new Date(backupData.createdAt),
      }));
  } catch (error) {
    return Left(new BackupDeserializationError(error));
  }
};
