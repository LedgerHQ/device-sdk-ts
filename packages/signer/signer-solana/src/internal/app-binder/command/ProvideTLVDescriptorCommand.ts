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

import {
  SOLANA_APP_ERRORS,
  SolanaAppCommandErrorFactory,
  type SolanaAppErrorCodes,
} from "./utils/SolanaApplicationErrors";

const CLA = 0xe0;
const INS = 0x21;
const P1 = 0x00;
const P2 = 0x00;

export type ProvideTLVDescriptorCommandArgs = {
  payload: Uint8Array; // Serialised signed TLV descriptor payload
};

export class ProvideTLVDescriptorCommand
  implements
    Command<Maybe<null>, ProvideTLVDescriptorCommandArgs, SolanaAppErrorCodes>
{
  private readonly errorHelper = new CommandErrorHelper<
    Maybe<null>,
    SolanaAppErrorCodes
  >(SOLANA_APP_ERRORS, SolanaAppCommandErrorFactory);

  args: ProvideTLVDescriptorCommandArgs;

  constructor(args: ProvideTLVDescriptorCommandArgs) {
    this.args = args;
  }

  getApdu(): Apdu {
    return new ApduBuilder({
      cla: CLA,
      ins: INS,
      p1: P1,
      p2: P2,
    })
      .addBufferToData(this.args.payload)
      .build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<Maybe<null>, SolanaAppErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(response),
    ).orDefaultLazy(() => {
      const parser = new ApduParser(response);
      if (parser.getUnparsedRemainingLength() !== 0) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("Unexpected response data"),
        });
      }
      return CommandResultFactory({ data: Maybe.of(null) });
    });
  }
}
