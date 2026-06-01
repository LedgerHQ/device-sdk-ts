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

import {
  P1,
  P2,
  ZCASH_CLA,
} from "@internal/app-binder/command/utils/apduHeaderUtils";

import {
  ZCASH_APP_ERRORS,
  ZcashAppCommandErrorFactory,
  type ZcashErrorCodes,
} from "./utils/zcashApplicationErrors";

const FINALIZE_INPUT = 0x4a;

export type HashOutputFullCommandArgs = {
  outputChunk: Uint8Array;
  isLastChunk: boolean;
};

export type HashOutputFullCommandResponse = ApduResponse;

export class HashOutputFullCommand
  implements
    Command<
      HashOutputFullCommandResponse,
      HashOutputFullCommandArgs,
      ZcashErrorCodes
    >
{
  readonly name = "HashOutputFull";

  private readonly errorHelper = new CommandErrorHelper<
    HashOutputFullCommandResponse,
    ZcashErrorCodes
  >(ZCASH_APP_ERRORS, ZcashAppCommandErrorFactory);

  constructor(private readonly args: HashOutputFullCommandArgs) {}

  getApdu(): Apdu {
    const apduArgs: ApduBuilderArgs = {
      cla: ZCASH_CLA,
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
  ): CommandResult<HashOutputFullCommandResponse, ZcashErrorCodes> {
    return Maybe.fromNullable(this.errorHelper.getError(response)).orDefault(
      CommandResultFactory({ data: response }),
    );
  }
}
