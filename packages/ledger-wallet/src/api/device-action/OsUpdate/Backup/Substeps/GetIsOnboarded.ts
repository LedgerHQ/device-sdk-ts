import {
  GetOsVersionCommand,
  type InternalApi,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { type Either, Left, Right } from "purify-ts/Either";

import { GetIsOnboardedError } from "@api/device-action/OsUpdate/Backup/CreateBackupDeviceActionErrors";

type GetIsOnboardedHandlerResponse = Promise<
  Either<GetIsOnboardedError, boolean>
>;

type GetIsOnboardedHandler = () => GetIsOnboardedHandlerResponse;

export const getIsOnboarded =
  (internalApi: InternalApi): GetIsOnboardedHandler =>
  async (): GetIsOnboardedHandlerResponse => {
    const result = await internalApi.sendCommand(new GetOsVersionCommand());

    if (!isSuccessCommandResult(result)) {
      return Left(new GetIsOnboardedError(result.error.originalError));
    }

    return Right(result.data.secureElementFlags.isOnboarded);
  };
