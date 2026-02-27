import {
  type Apdu,
  type ApduResponse,
  type Command,
  type CommandResult,
} from "@ledgerhq/device-management-kit";

import { type Signature } from "@api/model/Signature";

import { type AleoErrorCodes } from "./utils/aleoApplicationErrors";

export type SignMessageCommandArgs = {
  derivationPath: string;
  message: string | Uint8Array;
};

export type SignMessageCommandResponse = Signature;

export class SignMessageCommand
  implements
    Command<SignMessageCommandResponse, SignMessageCommandArgs, AleoErrorCodes>
{
  readonly name = "SignMessage";

  private readonly args: SignMessageCommandArgs;

  constructor(args: SignMessageCommandArgs) {
    this.args = args;
  }

  getApdu(): Apdu {
    throw new Error(
      `SignMessageCommand.getApdu() not implemented (args: ${JSON.stringify(this.args)})`,
    );
  }

  parseResponse(
    _apduResponse: ApduResponse,
  ): CommandResult<SignMessageCommandResponse, AleoErrorCodes> {
    throw new Error("SignMessageCommand.parseResponse() not implemented");
  }
}
