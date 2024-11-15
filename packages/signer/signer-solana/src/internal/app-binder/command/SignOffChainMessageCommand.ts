import {
  type Apdu,
  ApduBuilder,
  ApduParser,
  type ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
  CommandUtils,
  GlobalCommandErrorHandler,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";

import { type Signature } from "@api/model/Signature";

const SIGNATURE_LENGTH = 64;

export type SignOffChainMessageCommandResponse = Signature;
export type SignOffChainMessageCommandArgs = {
  readonly message: Uint8Array;
  readonly derivationPath: string;
};

export class SignOffChainMessageCommand
  implements
    Command<SignOffChainMessageCommandResponse, SignOffChainMessageCommandArgs>
{
  args: SignOffChainMessageCommandArgs;

  constructor(args: SignOffChainMessageCommandArgs) {
    this.args = args;
  }

  getApdu(): Apdu {
    return new ApduBuilder({
      cla: 0xe0,
      ins: 0x07,
      p1: 0x01,
      p2: 0x00,
    })
      .addBufferToData(this.args.message)
      .build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<SignOffChainMessageCommandResponse> {
    if (!CommandUtils.isSuccessResponse(response)) {
      return CommandResultFactory({
        error: GlobalCommandErrorHandler.handle(response),
      });
    }

    const parser = new ApduParser(response);

    if (!parser.testMinimalLength(SIGNATURE_LENGTH)) {
      return CommandResultFactory({
        error: new InvalidStatusWordError("Signature is missing or incomplete"),
      });
    }

    const signature = parser.extractFieldByLength(SIGNATURE_LENGTH);
    if (!signature) {
      return CommandResultFactory({
        error: new InvalidStatusWordError("Signature extraction failed"),
      });
    }
    return CommandResultFactory({
      data: signature,
    });
  }
}
