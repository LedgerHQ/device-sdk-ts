import {
  type InternalApi,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { type Either, Left, Right } from "purify-ts/Either";

import {
  RequestMasterConsentCommand,
  RequestMasterConsentCommandError,
} from "@api/command/OsUpdate/Restore/RequestMasterConsentCommand";
import { RequestMasterConsentError } from "@api/device-action/OsUpdate/Restore/RestoreBackup/RestoreBackupDeviceActionErrors";
import { RequestMasterConsentResult } from "@api/device-action/OsUpdate/Restore/RestoreBackup/types";

const CONSENT_FAILED = "5501";
const PIN_NOT_SET = "5502";

const INVALID_CONSENT_ERROR_CODES: Set<string> = new Set([
  CONSENT_FAILED,
  PIN_NOT_SET,
]);

type RequestMasterConsentHandlerArgs = {
  input: {
    languagePackConsentEnabled: boolean;
    lockScreenPictureConsentEnabled: boolean;
    appNumber: number;
    appStorageNumber: number;
  };
};

type RequestMasterConsentHandlerResponse = Promise<
  Either<RequestMasterConsentError, RequestMasterConsentResult>
>;

type RequestMasterConsentHandler = (
  args: RequestMasterConsentHandlerArgs,
) => RequestMasterConsentHandlerResponse;

export const requestMasterConsent =
  (internalApi: InternalApi): RequestMasterConsentHandler =>
  async ({
    input,
  }: RequestMasterConsentHandlerArgs): RequestMasterConsentHandlerResponse => {
    const result = await internalApi.sendCommand(
      new RequestMasterConsentCommand(input),
    );

    if (!isSuccessCommandResult(result)) {
      if (
        result.error instanceof RequestMasterConsentCommandError &&
        INVALID_CONSENT_ERROR_CODES.has(result.error.errorCode)
      ) {
        return Right(RequestMasterConsentResult.REJECTED);
      }
      return Left(new RequestMasterConsentError(result.error.originalError));
    }

    return Right(RequestMasterConsentResult.GRANTED);
  };
