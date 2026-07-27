import {
  type InternalApi,
  isSuccessCommandResult,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import { type Either, Left, Right } from "purify-ts/Either";

import { RestoreAppStorageError } from "@api/device-action/OsUpdate/Restore/RestoreAppsStorage/RestoreAppsStorageDeviceActionErrors";
import { RestoreAppStorageTask } from "@api/task/OsUpdate/Restore/RestoreAppStorageTask";

type RestoreAppStorageHandlerArgs = {
  input: { appStorageData: Uint8Array };
};

type RestoreAppStorageHandlerResponse = Promise<
  Either<RestoreAppStorageError, void>
>;

type RestoreAppStorageHandler = (
  args: RestoreAppStorageHandlerArgs,
) => RestoreAppStorageHandlerResponse;

export const restoreAppStorage =
  (
    internalApi: InternalApi,
    loggerFactory: (tag: string) => LoggerPublisherService,
  ): RestoreAppStorageHandler =>
  async ({
    input,
  }: RestoreAppStorageHandlerArgs): RestoreAppStorageHandlerResponse => {
    const logger = loggerFactory("RestoreAppStorageTask");
    const result = await new RestoreAppStorageTask(
      { appStorageData: input.appStorageData },
      internalApi,
      logger,
    ).run();

    if (!isSuccessCommandResult(result)) {
      return Left(new RestoreAppStorageError(result.error.originalError));
    }

    return Right(undefined);
  };
