import {
  type Apdu,
  ApduBuilder,
  type ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";

import { type Signature } from "@api/model/Signature";
import { type IconErrorCodes } from "./utils/iconAppErrors";

export type SignMessageCommandArgs = {
  derivationPath: string;
  message: string | Uint8Array;
};

export type SignMessageCommandResponse = Signature;

/**
 * SignMessageCommand for ICON
 *
 * Note: The ICON Ledger app does not support arbitrary message signing.
 * It only supports transaction signing via INS_SIGN.
 * This command exists for interface compatibility but will return an error.
 */
export class SignMessageCommand
  implements
    Command<SignMessageCommandResponse, SignMessageCommandArgs, IconErrorCodes>
{
  readonly name = "SignMessage";

  private readonly _args: SignMessageCommandArgs;

  constructor(args: SignMessageCommandArgs) {
    this._args = args;
  }

  getApdu(): Apdu {
    void this._args;
    return new ApduBuilder({
      cla: 0xe0,
      ins: 0x00,
      p1: 0x00,
      p2: 0x00,
    }).build();
  }

  parseResponse(
    _apduResponse: ApduResponse,
  ): CommandResult<SignMessageCommandResponse, IconErrorCodes> {
    return CommandResultFactory({
      error: new InvalidStatusWordError(
        "ICON does not support arbitrary message signing. Use signTransaction instead.",
      ),
    });
  }
}
