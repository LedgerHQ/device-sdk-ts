import {
  type Apdu,
  type ApduResponse,
  type Command,
  type CommandResult,
} from "@ledgerhq/device-management-kit";

import { type Signature } from "@api/model/Signature";

import { type TronAppErrorCodes } from "./utils/tronApplicationErrors";

export type SignPersonalMessageCommandArgs = {
  readonly derivationPath: string;
  readonly message: Uint8Array;
};

export type SignPersonalMessageCommandResponse = Signature;

export class SignPersonalMessageCommand
  implements
    Command<
      SignPersonalMessageCommandResponse,
      SignPersonalMessageCommandArgs,
      TronAppErrorCodes
    >
{
  readonly name = "SignPersonalMessage";

  private readonly _args: SignPersonalMessageCommandArgs;

  constructor(args: SignPersonalMessageCommandArgs) {
    this._args = args;
  }

  get args(): SignPersonalMessageCommandArgs {
    return this._args;
  }

  getApdu(): Apdu {
    // TODO: Implement APDU construction
    throw new Error("SignPersonalMessageCommand.getApdu() not implemented");
  }

  parseResponse(
    _apduResponse: ApduResponse,
  ): CommandResult<SignPersonalMessageCommandResponse, TronAppErrorCodes> {
    // TODO: Implement response parsing
    throw new Error(
      "SignPersonalMessageCommand.parseResponse() not implemented",
    );
  }
}
