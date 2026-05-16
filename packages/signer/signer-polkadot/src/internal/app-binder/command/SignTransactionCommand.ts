import {
  type Apdu,
  type ApduResponse,
  type Command,
  type CommandResult,
} from "@ledgerhq/device-management-kit";

import { type PolkadotErrorCodes } from "./utils/polkadotApplicationErrors";

export type SignTransactionCommandArgs = {
  derivationPath: string;
  blob: Uint8Array;
  metadata: Uint8Array;
};

export type SignTransactionCommandResponse = Uint8Array;

export class SignTransactionCommand
  implements
    Command<
      SignTransactionCommandResponse,
      SignTransactionCommandArgs,
      PolkadotErrorCodes
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
    // TODO: Implement APDU construction using this._args
    throw new Error("SignTransactionCommand.getApdu() not implemented");
  }

  parseResponse(
    _apduResponse: ApduResponse,
  ): CommandResult<SignTransactionCommandResponse, PolkadotErrorCodes> {
    // TODO: Implement response parsing based on your blockchain's protocol
    // return CommandResultFactory({ data: { ... } });
    throw new Error("SignTransactionCommand.parseResponse() not implemented");
  }
}
