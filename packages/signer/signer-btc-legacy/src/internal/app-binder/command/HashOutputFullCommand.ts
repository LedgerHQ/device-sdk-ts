import {
  type Apdu,
  ApduBuilder,
  type ApduBuilderArgs,
  type ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
} from "@ledgerhq/device-management-kit";
import { CommandErrorHelper } from "@ledgerhq/signer-utils";
import { Maybe } from "purify-ts";

import { type LegacyErrorConfig } from "@api/model/LegacyCoinProfile";
import {
  BTC_LEGACY_CLA,
  P1,
  P2,
} from "@internal/app-binder/command/utils/apduHeaderUtils";

const HASH_INPUT_FINALIZE_FULL_INS = 0x4a;

export type HashOutputFullCommandArgs = {
  readonly outputChunk: Uint8Array;
  readonly isLastChunk: boolean;
};

export type HashOutputFullCommandResponse = ApduResponse;

export class LegacyHashOutputFullCommand<ErrorCodes extends string>
  implements
    Command<
      HashOutputFullCommandResponse,
      HashOutputFullCommandArgs,
      ErrorCodes
    >
{
  readonly name = "HashOutputFull";

  private readonly args: HashOutputFullCommandArgs;

  private readonly errorHelper: CommandErrorHelper<
    HashOutputFullCommandResponse,
    ErrorCodes
  >;

  constructor(
    args: HashOutputFullCommandArgs,
    errors: LegacyErrorConfig<ErrorCodes>,
  ) {
    this.args = args;
    this.errorHelper = new CommandErrorHelper(errors.errors, errors.factory);
  }

  getApdu(): Apdu {
    const hashOutputFullArgs: ApduBuilderArgs = {
      cla: BTC_LEGACY_CLA,
      ins: HASH_INPUT_FINALIZE_FULL_INS,
      // 0x80 marks the last chunk, which the app answers once the outputs are
      // hashed.
      p1: this.args.isLastChunk ? P1.NEXT : P1.FIRST,
      p2: P2.DEFAULT,
    };

    return new ApduBuilder(hashOutputFullArgs)
      .addBufferToData(this.args.outputChunk)
      .build();
  }

  parseResponse(
    apduResponse: ApduResponse,
  ): CommandResult<HashOutputFullCommandResponse, ErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(apduResponse),
    ).orDefault(CommandResultFactory({ data: apduResponse }));
  }
}
