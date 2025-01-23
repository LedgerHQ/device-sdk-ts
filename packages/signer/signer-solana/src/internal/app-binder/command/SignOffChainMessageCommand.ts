import {
  type Apdu,
  ApduBuilder,
  ApduParser,
  type ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";
import { CommandErrorHelper } from "@ledgerhq/signer-utils";
import { Maybe } from "purify-ts";

import { type Signature } from "@api/model/Signature";

import {
  SOLANA_APP_ERRORS,
  SolanaAppCommandErrorFactory,
  type SolanaAppErrorCodes,
} from "./utils/SolanaApplicationErrors";

const SIGNATURE_LENGTH = 64;

export type SignOffChainMessageCommandResponse = Signature;
export type SignOffChainMessageCommandArgs = {
  readonly message: Uint8Array;
  readonly derivationPath: string;
};

export class SignOffChainMessageCommand
  implements
    Command<
      SignOffChainMessageCommandResponse,
      SignOffChainMessageCommandArgs,
      SolanaAppErrorCodes
    >
{
  private readonly errorHelper = new CommandErrorHelper<
    SignOffChainMessageCommandResponse,
    SolanaAppErrorCodes
  >(SOLANA_APP_ERRORS, SolanaAppCommandErrorFactory);

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
  ): CommandResult<SignOffChainMessageCommandResponse, SolanaAppErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(response),
    ).orDefaultLazy(() => {
      const parser = new ApduParser(response);

      const signature = parser.extractFieldByLength(SIGNATURE_LENGTH);
      if (!signature) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("Signature extraction failed"),
        });
      }

      return CommandResultFactory({
        data: signature,
      });
    });
  }
}
