import {
  type InternalApi,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { type Either, Left, Right } from "purify-ts/Either";

import { CommitRestoreAppStorageCommand } from "@api/command/OsUpdate/Restore/CommitRestoreAppStorageCommand";
import { CommitRestoreAppStorageError } from "@api/device-action/OsUpdate/Restore/RestoreAppsStorage/RestoreAppsStorageDeviceActionErrors";

type CommitRestoreAppStorageHandlerResponse = Promise<
  Either<CommitRestoreAppStorageError, void>
>;

type CommitRestoreAppStorageHandler =
  () => CommitRestoreAppStorageHandlerResponse;

export const commitRestoreAppStorage =
  (internalApi: InternalApi): CommitRestoreAppStorageHandler =>
  async (): CommitRestoreAppStorageHandlerResponse => {
    const result = await internalApi.sendCommand(
      new CommitRestoreAppStorageCommand(),
    );

    if (!isSuccessCommandResult(result)) {
      return Left(new CommitRestoreAppStorageError(result.error.originalError));
    }

    return Right(undefined);
  };
