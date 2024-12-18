import {
  type Apdu,
  ApduBuilder,
  type ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
} from "@ledgerhq/device-management-kit";
import { CommandErrorHelper } from "@ledgerhq/signer-utils";
import { Maybe } from "purify-ts";

import {
  BTC_APP_ERRORS,
  BtcAppCommandErrorFactory,
  type BtcErrorCodes,
} from "@internal/app-binder/command/utils/bitcoinAppErrors";

export type ContinueCommandArgs = {
  payload: Uint8Array;
};

export type ContinueCommandResponse = ApduResponse;

export class ContinueCommand
  implements
    Command<ContinueCommandResponse, ContinueCommandArgs, BtcErrorCodes>
{
  _errorHelper: CommandErrorHelper<ContinueCommandResponse, BtcErrorCodes>;
  constructor(
    private readonly _args: ContinueCommandArgs,
    errorHelper?: CommandErrorHelper<ContinueCommandResponse, BtcErrorCodes>,
  ) {
    this._errorHelper =
      errorHelper ||
      new CommandErrorHelper(BTC_APP_ERRORS, BtcAppCommandErrorFactory);
  }

  getApdu(): Apdu {
    return new ApduBuilder({
      cla: 0xf8,
      ins: 0x01,
      p1: 0x00,
      p2: 0x00,
    })
      .addBufferToData(this._args.payload)
      .build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<ContinueCommandResponse, BtcErrorCodes> {
    return Maybe.fromNullable(this._errorHelper.getError(response)).orDefault(
      CommandResultFactory({
        data: response,
      }),
    );
  }
}
