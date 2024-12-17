import {
  type Apdu,
  ApduParser,
  type ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
  GlobalCommandErrorHandler,
  isCommandErrorCode,
} from "@ledgerhq/device-management-kit";
import { Just, type Maybe, Nothing } from "purify-ts";

import {
  BitcoinAppCommandError,
  type BitcoinAppErrorCodes,
  BTC_APP_ERRORS,
} from "@internal/app-binder/command/utils/bitcoinAppErrors";
import { CommandUtils } from "@internal/utils/CommandUtils";

export abstract class BtcCommand<Response, Args = void>
  implements Command<Response, Args, BitcoinAppErrorCodes>
{
  getApdu(_args: Args): Apdu {
    throw new Error("Not implemented");
  }

  parseResponse(
    _response: ApduResponse,
  ): CommandResult<Response, BitcoinAppErrorCodes> {
    throw new Error("Method not implemented.");
  }

  protected _getError(
    apduResponse: ApduResponse,
  ): Maybe<CommandResult<Response, BitcoinAppErrorCodes>> {
    const apduParser = new ApduParser(apduResponse);
    const errorCode = apduParser.encodeToHexaString(apduResponse.statusCode);

    if (isCommandErrorCode(errorCode, BTC_APP_ERRORS)) {
      return Just(
        CommandResultFactory<Response, BitcoinAppErrorCodes>({
          error: new BitcoinAppCommandError({
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
