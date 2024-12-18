import {
  type Apdu,
  ApduParser,
  type ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
  CommandUtils,
  GlobalCommandErrorHandler,
  isCommandErrorCode,
} from "@ledgerhq/device-management-kit";
import { Just, type Maybe, Nothing } from "purify-ts";

import {
  BTC_APP_ERRORS,
  BtcAppCommandError,
  type BtcErrorCodes,
} from "@internal/app-binder/command/utils/bitcoinAppErrors";

export abstract class BtcCommand<Response, Args = void>
  implements Command<Response, Args, BtcErrorCodes>
{
  getApdu(_args: Args): Apdu {
    throw new Error("Not implemented");
  }

  parseResponse(
    _response: ApduResponse,
  ): CommandResult<Response, BtcErrorCodes> {
    throw new Error("Method not implemented.");
  }

  protected _getError(
    apduResponse: ApduResponse,
  ): Maybe<CommandResult<Response, BtcErrorCodes>> {
    const apduParser = new ApduParser(apduResponse);
    const errorCode = apduParser.encodeToHexaString(apduResponse.statusCode);

    if (isCommandErrorCode(errorCode, BTC_APP_ERRORS)) {
      return Just(
        CommandResultFactory<Response, BtcErrorCodes>({
          error: new BtcAppCommandError({
            ...BTC_APP_ERRORS[errorCode],
            errorCode,
          }),
        }),
      );
    }
    if (!CommandUtils.isSuccessResponse(apduResponse)) {
      return Just(
        CommandResultFactory({
          error: GlobalCommandErrorHandler.handle(apduResponse),
        }),
      );
    }
    return Nothing;
  }
}
