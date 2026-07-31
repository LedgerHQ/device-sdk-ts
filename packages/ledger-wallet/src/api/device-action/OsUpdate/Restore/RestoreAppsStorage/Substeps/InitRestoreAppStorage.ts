import {
  type InternalApi,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { type Either, Left, Right } from "purify-ts/Either";

import {
  InitRestoreAppStorageCommand,
  InitRestoreAppStorageCommandError,
} from "@api/command/OsUpdate/Restore/InitRestoreAppStorageCommand";
import { InitRestoreAppStorageError } from "@api/device-action/OsUpdate/Restore/RestoreAppsStorage/RestoreAppsStorageDeviceActionErrors";
import { InitRestoreAppStorageConsentResult } from "@api/device-action/OsUpdate/Restore/RestoreAppsStorage/types";

// "5501" = rejected by user, "5502" = pin is not set
const INVALID_CONSENT_ERROR_CODES: string[] = ["5501", "5502"];

type InitRestoreAppStorageHandlerArgs = {
  input: { appName: string; appStorageDataLength: number };
};

type InitRestoreAppStorageHandlerResponse = Promise<
  Either<InitRestoreAppStorageError, InitRestoreAppStorageConsentResult>
>;

type InitRestoreAppStorageHandler = (
  args: InitRestoreAppStorageHandlerArgs,
) => InitRestoreAppStorageHandlerResponse;

export const initRestoreAppStorage =
  (internalApi: InternalApi): InitRestoreAppStorageHandler =>
  async ({
    input,
  }: InitRestoreAppStorageHandlerArgs): InitRestoreAppStorageHandlerResponse => {
    const { appName, appStorageDataLength } = input;
    const result = await internalApi.sendCommand(
      new InitRestoreAppStorageCommand({ appName, appStorageDataLength }),
    );

    if (!isSuccessCommandResult(result)) {
      if (
        result.error instanceof InitRestoreAppStorageCommandError &&
        INVALID_CONSENT_ERROR_CODES.includes(result.error.errorCode)
      ) {
        return Right(InitRestoreAppStorageConsentResult.REJECTED);
      }
      return Left(new InitRestoreAppStorageError(result.error.originalError));
    }

    return Right(InitRestoreAppStorageConsentResult.GRANTED);
  };
