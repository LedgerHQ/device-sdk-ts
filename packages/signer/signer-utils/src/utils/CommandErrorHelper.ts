import {
  ApduParser,
  type ApduResponse,
  type CommandErrorArgs,
  type CommandErrors,
  type CommandResult,
  CommandResultFactory,
  CommandUtils,
  type DeviceExchangeError,
  GlobalCommandErrorHandler,
  isCommandErrorCode,
} from "@ledgerhq/device-management-kit";

export class CommandErrorHelper<Response, ErrorCodes extends string> {
  constructor(
    private readonly _errors: CommandErrors<ErrorCodes>,
    private readonly _errorFactory: (
      args: CommandErrorArgs<ErrorCodes>,
    ) => DeviceExchangeError<ErrorCodes>,
    private readonly _isSuccessResponse = CommandUtils.isSuccessResponse,
  ) {}

  getError(
    apduResponse: ApduResponse,
  ): CommandResult<Response, ErrorCodes> | undefined {
    const apduParser = new ApduParser(apduResponse);
    const errorCode = apduParser.encodeToHexaString(apduResponse.statusCode);

    if (isCommandErrorCode(errorCode, this._errors)) {
      return CommandResultFactory<Response, ErrorCodes>({
        error: this._errorFactory({
          ...this._errors[errorCode],
          errorCode,
        }),
      });
    }
    if (!this._isSuccessResponse(apduResponse)) {
      return CommandResultFactory({
        error: GlobalCommandErrorHandler.handle(apduResponse),
      });
    }
    return undefined;
  }
}
