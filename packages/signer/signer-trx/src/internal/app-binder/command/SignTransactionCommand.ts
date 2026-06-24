import {
  type Apdu,
  type ApduResponse,
  type Command,
  type CommandResult,
} from "@ledgerhq/device-management-kit";

import { type Signature } from "@api/model/Signature";

import { type TronAppErrorCodes } from "./utils/tronApplicationErrors";

export type SignTransactionCommandArgs = {
  readonly derivationPath: string;
  readonly serializedTransaction: Uint8Array;
};

export type SignTransactionCommandResponse = Signature;

export class SignTransactionCommand
  implements
    Command<
      SignTransactionCommandResponse,
      SignTransactionCommandArgs,
      TronAppErrorCodes
    >
{
  readonly name = "SignTransaction";

  private readonly _args: SignTransactionCommandArgs;

  constructor(args: SignTransactionCommandArgs) {
    this._args = args;
  }

  get args(): SignTransactionCommandArgs {
    return this._args;
  }

  getApdu(): Apdu {
    // TODO: Implement APDU construction
    throw new Error("SignTransactionCommand.getApdu() not implemented");
  }

  parseResponse(
    _apduResponse: ApduResponse,
  ): CommandResult<SignTransactionCommandResponse, TronAppErrorCodes> {
    // TODO: Implement response parsing
    throw new Error("SignTransactionCommand.parseResponse() not implemented");
  }
}
