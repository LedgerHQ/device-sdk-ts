import {
  type Apdu,
  ApduBuilder,
  ApduParser,
  type ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
  InvalidStatusWordError,
  isCommandErrorCode,
} from "@ledgerhq/device-management-kit";

import { type Signature } from "@api/model/Signature";

import {
  SolanaAppCommandError,
  solanaAppErrors,
} from "./utils/solanaAppErrors";

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
    const parser = new ApduParser(response);
    const errorCode = parser.encodeToHexaString(response.statusCode);
    if (isCommandErrorCode(errorCode, solanaAppErrors)) {
      return CommandResultFactory({
        error: new SolanaAppCommandError({
          ...solanaAppErrors[errorCode],
          errorCode,
        }),
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
