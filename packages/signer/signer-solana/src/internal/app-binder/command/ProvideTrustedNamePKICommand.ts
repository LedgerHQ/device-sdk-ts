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

const CLA = 0xb0;
const INS = 0x06;
const P1 = 0x04;
const P2 = 0x00;
const FIXED_LENGTH_BYTES = 0x15;

export type ProvideTrustedNamePKICommandArgs = {
  descriptor: Uint8Array; // raw certificate blob
  signature: Uint8Array; // raw signature bytes
};

export class ProvideTrustedNamePKICommand
  implements
    Command<Maybe<null>, ProvideTrustedNamePKICommandArgs, SolanaAppErrorCodes>
{
  private readonly errorHelper = new CommandErrorHelper<
    Maybe<null>,
    SolanaAppErrorCodes
  >(SOLANA_APP_ERRORS, SolanaAppCommandErrorFactory);

  args: ProvideTrustedNamePKICommandArgs;

  constructor(args: ProvideTrustedNamePKICommandArgs) {
    this.args = args;
  }

  getApdu(): Apdu {
    const { descriptor, signature } = this.args;

    return new ApduBuilder({
      cla: CLA,
      ins: INS,
      p1: P1,
      p2: P2,
    })
      .addBufferToData(descriptor)
      .add8BitUIntToData(FIXED_LENGTH_BYTES)
      .add8BitUIntToData(signature.length)
      .addBufferToData(signature)
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
