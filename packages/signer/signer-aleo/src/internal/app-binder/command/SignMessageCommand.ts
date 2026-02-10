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
    // TODO: Implement APDU construction based on your blockchain's protocol
    // Example structure:
    // const builder = new ApduBuilder({ cla: 0xe0, ins: 0x02, p1: 0x00, p2: 0x00 });
    // Add derivation path and other data to builder
    // return builder.build();
    throw new Error("SignMessageCommand.getApdu() not implemented");
  }

  parseResponse(
    _apduResponse: ApduResponse,
  ): CommandResult<SignMessageCommandResponse, AleoErrorCodes> {
    // TODO: Implement response parsing based on your blockchain's protocol
    // return CommandResultFactory({ data: { ... } });
    throw new Error("SignMessageCommand.parseResponse() not implemented");
  }
}
