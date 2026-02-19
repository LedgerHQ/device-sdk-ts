import {
  type Apdu,
  type ApduResponse,
  type Command,
  type CommandResult,
} from "@ledgerhq/device-management-kit";

import { type HyperliquidErrorCodes } from "./utils/hyperliquidApplicationErrors";

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
    Command<SignTransactionCommandResponse, SignTransactionCommandArgs, HyperliquidErrorCodes>
{
  readonly name = "SignTransaction";

  private readonly args: SignTransactionCommandArgs;

  constructor(args: SignTransactionCommandArgs) {
    this.args = args;
  }

  getApdu(): Apdu {
    // TODO: Implement APDU construction based on your blockchain's protocol
    // Example structure:
    // const builder = new ApduBuilder({ cla: 0xe0, ins: 0x02, p1: 0x00, p2: 0x00 });
    // Add derivation path and other data to builder
    // return builder.build();

    console.log("To avoid errors:", this.args.derivationPath);
    throw new Error("SignTransactionCommand.getApdu() not implemented");
  }

  parseResponse(
    _apduResponse: ApduResponse,
  ): CommandResult<SignTransactionCommandResponse, HyperliquidErrorCodes> {
    // TODO: Implement response parsing based on your blockchain's protocol
    // return CommandResultFactory({ data: { ... } });
    throw new Error("SignTransactionCommand.parseResponse() not implemented");
  }
}
