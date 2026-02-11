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
import { type AlgorandErrorCodes } from "./utils/algorandAppErrors";

export type SignMessageCommandArgs = {
  derivationPath: string;
  message: string | Uint8Array;
};

export type SignMessageCommandResponse = Signature;

/**
 * SignMessageCommand for Algorand
 *
 * Note: The Algorand Ledger app does not support arbitrary message signing.
 * It only supports signing msgpack-encoded transactions via INS_SIGN_MSGPACK.
 * This command exists for interface compatibility but will return an error.
 *
 * For transaction signing, use SignTransactionCommand instead.
 */
export class SignMessageCommand
  implements
    Command<SignMessageCommandResponse, SignMessageCommandArgs, AlgorandErrorCodes>
{
  readonly name = "SignMessage";

  private readonly _args: SignMessageCommandArgs;

  constructor(args: SignMessageCommandArgs) {
    this._args = args;
  }

  getApdu(): Apdu {
    // Algorand doesn't support arbitrary message signing
    // We still need to return a valid APDU structure
    void this._args;
    return new ApduBuilder({
      cla: 0x80,
      ins: 0x00, // Invalid instruction to indicate not supported
      p1: 0x00,
      p2: 0x00,
    }).build();
  }

  parseResponse(
    _apduResponse: ApduResponse,
  ): CommandResult<SignMessageCommandResponse, AlgorandErrorCodes> {
    // Always return an error since Algorand doesn't support message signing
    return CommandResultFactory({
      error: new InvalidStatusWordError(
        "Algorand does not support arbitrary message signing. Use signTransaction for msgpack-encoded transactions.",
      ),
    });
  }
}
