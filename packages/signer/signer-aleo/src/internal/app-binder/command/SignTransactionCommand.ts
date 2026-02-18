import {
  type Apdu,
  type ApduResponse,
  type Command,
  type CommandResult,
} from "@ledgerhq/device-management-kit";

import { type AleoErrorCodes } from "./utils/aleoApplicationErrors";

export type SignTransactionCommandArgs = {
  derivationPath: string;
  transaction: Uint8Array;
};

export type SignTransactionCommandResponse = {
  signature: {
    r: string;
    s: string;
    v?: number;
  };
};

export class SignTransactionCommand
  implements
    Command<
      SignTransactionCommandResponse,
      SignTransactionCommandArgs,
      AleoErrorCodes
    >
{
  readonly name = "SignTransaction";

  private readonly args: SignTransactionCommandArgs;

  constructor(args: SignTransactionCommandArgs) {
    this.args = args;
  }

  getApdu(): Apdu {
    throw new Error(
      `SignTransactionCommand.getApdu() not implemented (args: ${JSON.stringify(this.args)})`,
    );
  }

  parseResponse(
    _apduResponse: ApduResponse,
  ): CommandResult<SignTransactionCommandResponse, AleoErrorCodes> {
    throw new Error("SignTransactionCommand.parseResponse() not implemented");
  }
}
