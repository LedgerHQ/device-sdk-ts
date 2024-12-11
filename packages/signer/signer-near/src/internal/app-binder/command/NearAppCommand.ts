import {
  type Apdu,
  type ApduParser,
  type ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
  GlobalCommandErrorHandler,
  isCommandErrorCode,
} from "@ledgerhq/device-management-kit";
import {
  type CommandErrorArgs,
  type CommandErrors,
  DeviceExchangeError,
} from "@ledgerhq/device-management-kit";

export type NearAppErrorCodes = "6985";
export const NEAR_APP_ERRORS: CommandErrors<NearAppErrorCodes> = {
  "6985": { message: "Action rejected by user" },
};

export class NearAppCommandError extends DeviceExchangeError<NearAppErrorCodes> {
  constructor({ message, errorCode }: CommandErrorArgs<NearAppErrorCodes>) {
    super({ tag: "NearAppCommandError", message, errorCode });
  }
}

export abstract class NearAppCommand<Response, Args>
  implements Command<Response, Args, NearAppErrorCodes>
{
  getApdu(): Apdu {
    throw new Error("Method not implemented.");
  }
  parseResponse(
    _response: ApduResponse,
  ): CommandResult<Response, NearAppErrorCodes> {
    throw new Error("Method not implemented.");
  }
  protected _getError(
    response: ApduResponse,
    parser: ApduParser,
  ): CommandResult<Response, NearAppErrorCodes> {
    const errorCode = parser.encodeToHexaString(response.statusCode);

    if (isCommandErrorCode(errorCode, NEAR_APP_ERRORS)) {
      return CommandResultFactory({
        error: new NearAppCommandError({
          ...NEAR_APP_ERRORS[errorCode],
          errorCode,
        }),
      });
    }
    return CommandResultFactory({
      error: GlobalCommandErrorHandler.handle(response),
    });
  }
}
