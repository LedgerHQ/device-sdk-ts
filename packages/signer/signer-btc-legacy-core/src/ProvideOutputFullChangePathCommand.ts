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
import { CommandErrorHelper, DerivationPathUtils } from "./signerUtils";

const FINALIZE_INPUT = 0x4a;

export type ProvideOutputFullChangePathCommandArgs = {
  derivationPath: string;
};

export type ProvideOutputFullChangePathCommandResponse = ApduResponse;

export class LegacyProvideOutputFullChangePathCommand<ErrorCodes extends string>
  implements
    Command<
      ProvideOutputFullChangePathCommandResponse,
      ProvideOutputFullChangePathCommandArgs,
      ErrorCodes
    >
{
  readonly name = "ProvideOutputFullChangePath";
  private readonly errorHelper: CommandErrorHelper<
    ProvideOutputFullChangePathCommandResponse,
    ErrorCodes
  >;

  constructor(
    private readonly args: ProvideOutputFullChangePathCommandArgs,
    errors: LegacyErrorConfig<ErrorCodes>,
  ) {
    this.errorHelper = new CommandErrorHelper(errors.errors, errors.factory);
  }

  getApdu(): Apdu {
    const apduArgs: ApduBuilderArgs = {
      cla: BTC_LEGACY_CLA,
      ins: FINALIZE_INPUT,
      p1: P1.CHANGE_PATH,
      p2: P2.DEFAULT,
    };
    const builder = new ApduBuilder(apduArgs);
    const path = DerivationPathUtils.splitPath(this.args.derivationPath);
    builder.add8BitUIntToData(path.length);
    path.forEach((element) => {
      builder.add32BitUIntToData(element);
    });
    return builder.build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<ProvideOutputFullChangePathCommandResponse, ErrorCodes> {
    return Maybe.fromNullable(this.errorHelper.getError(response)).orDefault(
      CommandResultFactory({ data: response }),
    );
  }
}
