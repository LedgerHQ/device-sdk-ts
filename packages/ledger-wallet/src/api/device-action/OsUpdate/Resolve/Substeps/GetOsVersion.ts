import {
  GetOsVersionCommand,
  type GetOsVersionResponse,
  type InternalApi,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { type Either, Left, Right } from "purify-ts/Either";

import { GetOsVersionError } from "@api/device-action/OsUpdate/Resolve/ResolveOsUpdatePathDeviceActionErrors";

type GetOsVersionHandlerResponse = Promise<
  Either<GetOsVersionError, GetOsVersionResponse>
>;

type GetOsVersionHandler = () => GetOsVersionHandlerResponse;

export const getOsVersion =
  (internalApi: InternalApi): GetOsVersionHandler =>
  async (): GetOsVersionHandlerResponse => {
    const result = await internalApi.sendCommand(new GetOsVersionCommand());

    if (!isSuccessCommandResult(result)) {
      return Left(new GetOsVersionError(result.error.originalError));
    }

    return Right(result.data);
  };
