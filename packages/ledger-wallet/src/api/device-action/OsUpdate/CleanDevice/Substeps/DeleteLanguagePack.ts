import {
  DeleteLanguagePackCommand,
  DeleteLanguagePackDAError,
  type InternalApi,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { type Either, Left, Right } from "purify-ts/Either";

type DeleteLanguagePackHandlerResponse = Promise<
  Either<DeleteLanguagePackDAError, void>
>;

type DeleteLanguagePackHandler = () => DeleteLanguagePackHandlerResponse;

export const deleteLanguagePack =
  (internalApi: InternalApi): DeleteLanguagePackHandler =>
  async (): DeleteLanguagePackHandlerResponse => {
    const result = await internalApi.sendCommand(
      new DeleteLanguagePackCommand({ languagePackageId: 0xff }),
    );

    if (!isSuccessCommandResult(result)) {
      return Left(
        new DeleteLanguagePackDAError(
          "message" in result.error
            ? result.error.message
            : "Delete language pack failed.",
        ),
      );
    }

    return Right(undefined);
  };
