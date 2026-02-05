import {
  type Apdu,
  type ApduResponse,
  type Command,
  type CommandResult,
} from "@ledgerhq/device-management-kit";

import { type HederaErrorCodes } from "./utils/hederaApplicationErrors";

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
    Command<SignTransactionCommandResponse, SignTransactionCommandArgs, HederaErrorCodes>
{
  readonly name = "SignTransaction";

  private readonly _args: SignTransactionCommandArgs;

  constructor(args: SignTransactionCommandArgs) {
    this._args = args;
  }

  getApdu(): Apdu {
    // TODO: Implement APDU construction based on your blockchain's protocol
    // Example structure:
    // const builder = new ApduBuilder({ cla: 0xe0, ins: 0x02, p1: 0x00, p2: 0x00 });
    // Add derivation path and other data to builder
    // return builder.build();
    void this._args; // TODO: Use args to build APDU
    throw new Error("SignTransactionCommand.getApdu() not implemented");
  }

  parseResponse(
    _apduResponse: ApduResponse,
  ): CommandResult<SignTransactionCommandResponse, HederaErrorCodes> {
    // TODO: Implement response parsing based on your blockchain's protocol
    // return CommandResultFactory({ data: { ... } });
    throw new Error("SignTransactionCommand.parseResponse() not implemented");
  }
}
