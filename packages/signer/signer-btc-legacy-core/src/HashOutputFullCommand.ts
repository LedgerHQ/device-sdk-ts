import {
  type Apdu,
  ApduBuilder,
  type ApduBuilderArgs,
  type ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
} from "@ledgerhq/device-management-kit";
import { Maybe } from "purify-ts";

import { BTC_LEGACY_CLA, P1, P2 } from "./apduHeader";
import { type LegacyErrorConfig } from "./errors";
import { CommandErrorHelper } from "./signerUtils";

const FINALIZE_INPUT = 0x4a;

export type HashOutputFullCommandArgs = {
  outputChunk: Uint8Array;
  isLastChunk: boolean;
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
  private readonly errorHelper: CommandErrorHelper<
    HashOutputFullCommandResponse,
    ErrorCodes
  >;

  constructor(
    private readonly args: HashOutputFullCommandArgs,
    errors: LegacyErrorConfig<ErrorCodes>,
  ) {
    this.errorHelper = new CommandErrorHelper(errors.errors, errors.factory);
  }

  getApdu(): Apdu {
    const apduArgs: ApduBuilderArgs = {
      cla: BTC_LEGACY_CLA,
      ins: FINALIZE_INPUT,
      p1: this.args.isLastChunk ? P1.NEXT : P1.FIRST,
      p2: P2.DEFAULT,
    };
    return new ApduBuilder(apduArgs)
      .addBufferToData(this.args.outputChunk)
      .build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<HashOutputFullCommandResponse, ErrorCodes> {
    return Maybe.fromNullable(this.errorHelper.getError(response)).orDefault(
      CommandResultFactory({ data: response }),
    );
  }
}
