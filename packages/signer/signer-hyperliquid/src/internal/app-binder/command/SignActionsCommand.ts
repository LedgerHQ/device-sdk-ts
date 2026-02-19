import {
  type Apdu,
  type ApduResponse,
  type Command,
  type CommandResult,
} from "@ledgerhq/device-management-kit";

import { type HyperliquidErrorCodes } from "./utils/hyperliquidApplicationErrors";

export type SignActionsCommandArgs = {
  derivationPath: string;
  Actions: Uint8Array;
};

export type SignActionsCommandResponse = {
  signature: {
    r: string;
    s: string;
    v?: number;
  };
};

export class SignActionsCommand
  implements
    Command<SignActionsCommandResponse, SignActionsCommandArgs, HyperliquidErrorCodes>
{
  readonly name = "SignActions";

  private readonly args: SignActionsCommandArgs;

  constructor(args: SignActionsCommandArgs) {
    this.args = args;
  }

  getApdu(): Apdu {
    // TODO: Implement APDU construction based on your blockchain's protocol
    // Example structure:
    // const builder = new ApduBuilder({ cla: 0xe0, ins: 0x02, p1: 0x00, p2: 0x00 });
    // Add derivation path and other data to builder
    // return builder.build();

    console.log("To avoid errors:", this.args.derivationPath);
    throw new Error("SignActionsCommand.getApdu() not implemented");
  }

  parseResponse(
    _apduResponse: ApduResponse,
  ): CommandResult<SignActionsCommandResponse, HyperliquidErrorCodes> {
    // TODO: Implement response parsing based on your blockchain's protocol
    // return CommandResultFactory({ data: { ... } });
    throw new Error("SignActionsCommand.parseResponse() not implemented");
  }
}
