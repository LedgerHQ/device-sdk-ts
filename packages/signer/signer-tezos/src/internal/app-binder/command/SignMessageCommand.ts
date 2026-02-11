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
import { type TezosErrorCodes } from "./utils/tezosAppErrors";

export type SignMessageCommandArgs = {
  derivationPath: string;
  message: string | Uint8Array;
};

export type SignMessageCommandResponse = Signature;

/**
 * Tezos does not support arbitrary message signing in the standard Ledger app.
 * The signOperation method should be used instead for signing operations.
 * This command is a placeholder that returns an error.
 */
export class SignMessageCommand
  implements Command<SignMessageCommandResponse, SignMessageCommandArgs, TezosErrorCodes>
{
  readonly name = "SignMessage";

  private readonly _args: SignMessageCommandArgs;

  constructor(args: SignMessageCommandArgs) {
    this._args = args;
  }

  getApdu(): Apdu {
    void this._args;
    // Return a dummy APDU - this will never actually be sent
    return new ApduBuilder({ cla: 0x80, ins: 0x00, p1: 0x00, p2: 0x00 }).build();
  }

  parseResponse(
    _apduResponse: ApduResponse,
  ): CommandResult<SignMessageCommandResponse, TezosErrorCodes> {
    return CommandResultFactory({
      error: new InvalidStatusWordError(
        "Tezos does not support arbitrary message signing. Use signTransaction instead.",
      ),
    });
  }
}
