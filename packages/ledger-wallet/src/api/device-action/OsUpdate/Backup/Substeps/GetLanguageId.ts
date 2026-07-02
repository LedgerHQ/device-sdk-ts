import {
  GetOsVersionCommand,
  type InternalApi,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { type Either, Left, Right } from "purify-ts/Either";

import { GetLanguageIdError } from "@api/device-action/OsUpdate/Backup/CreateBackupDeviceActionErrors";

type GetLanguageIdHandlerResponse = Promise<
  Either<GetLanguageIdError, number | undefined>
>;

type GetLanguageIdHandler = () => GetLanguageIdHandlerResponse;

export const getLanguageId =
  (internalApi: InternalApi): GetLanguageIdHandler =>
  async (): GetLanguageIdHandlerResponse => {
    const result = await internalApi.sendCommand(new GetOsVersionCommand());

    if (!isSuccessCommandResult(result)) {
      return Left(new GetLanguageIdError(result.error.originalError));
    }

    return Right(result.data.langId);
  };
