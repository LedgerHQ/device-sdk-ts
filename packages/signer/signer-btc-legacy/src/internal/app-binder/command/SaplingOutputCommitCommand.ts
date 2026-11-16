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

const HASH_SIGN_INS = 0x48;
// A sign command without a path: no key signs, the app commits the outputs.
const EMPTY_PATH_LENGTH = 0x00;
const USER_VALIDATION_CODE_LENGTH = 0x00;

export type SaplingOutputCommitCommandArgs = {
  readonly lockTime: number;
  readonly sigHashType: number;
  readonly expiryHeight: Uint8Array;
};

export type SaplingOutputCommitCommandResponse = ApduResponse;

/**
 * The sign command a transaction in the sapling format sends once its outputs
 * are hashed, before the inputs are signed one by one.
 */
export class LegacySaplingOutputCommitCommand<ErrorCodes extends string>
  implements
    Command<
      SaplingOutputCommitCommandResponse,
      SaplingOutputCommitCommandArgs,
      ErrorCodes
    >
{
  readonly name = "SaplingOutputCommit";

  private readonly args: SaplingOutputCommitCommandArgs;

  private readonly errorHelper: CommandErrorHelper<
    SaplingOutputCommitCommandResponse,
    ErrorCodes
  >;

  constructor(
    args: SaplingOutputCommitCommandArgs,
    errors: LegacyErrorConfig<ErrorCodes>,
  ) {
    this.args = args;
    this.errorHelper = new CommandErrorHelper(errors.errors, errors.factory);
  }

  getApdu(): Apdu {
    const saplingOutputCommitArgs: ApduBuilderArgs = {
      cla: BTC_LEGACY_CLA,
      ins: HASH_SIGN_INS,
      p1: P1.FIRST,
      p2: P2.DEFAULT,
    };

    return new ApduBuilder(saplingOutputCommitArgs)
      .add8BitUIntToData(EMPTY_PATH_LENGTH)
      .add8BitUIntToData(USER_VALIDATION_CODE_LENGTH)
      .add32BitUIntToData(this.args.lockTime)
      .add8BitUIntToData(this.args.sigHashType)
      .addBufferToData(this.args.expiryHeight)
      .build();
  }

  parseResponse(
    apduResponse: ApduResponse,
  ): CommandResult<SaplingOutputCommitCommandResponse, ErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(apduResponse),
    ).orDefault(CommandResultFactory({ data: apduResponse }));
  }
}
