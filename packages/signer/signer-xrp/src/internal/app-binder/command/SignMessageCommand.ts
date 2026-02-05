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
import { type XrpErrorCodes } from "./utils/xrpAppErrors";

export type SignMessageCommandArgs = {
  derivationPath: string;
  message: string | Uint8Array;
};

export type SignMessageCommandResponse = Signature;

/**
 * Note: The XRP Ledger app does not support message signing.
 * This command will always fail with an error.
 * XRP only supports transaction signing via the signTransaction method.
 */
export class SignMessageCommand
  implements
    Command<SignMessageCommandResponse, SignMessageCommandArgs, XrpErrorCodes>
{
  readonly name = "SignMessage";

  private readonly _args: SignMessageCommandArgs;

  constructor(args: SignMessageCommandArgs) {
    this._args = args;
  }

  getApdu(): Apdu {
    // XRP Ledger app does not support message signing
    // We return an empty APDU that will trigger an error
    void this._args;
    return new ApduBuilder({
      cla: 0xe0,
      ins: 0x00, // Invalid instruction for XRP
      p1: 0x00,
      p2: 0x00,
    }).build();
  }

  parseResponse(
    _response: ApduResponse,
  ): CommandResult<SignMessageCommandResponse, XrpErrorCodes> {
    // XRP does not support message signing
    return CommandResultFactory({
      error: new InvalidStatusWordError(
        "XRP Ledger app does not support message signing. Use signTransaction for XRP transactions.",
      ),
    });
  }
}
