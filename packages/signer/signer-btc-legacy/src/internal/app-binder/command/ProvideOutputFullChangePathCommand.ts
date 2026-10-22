import {
  type Apdu,
  ApduBuilder,
  type ApduBuilderArgs,
  type ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
} from "@ledgerhq/device-management-kit";
import {
  CommandErrorHelper,
  DerivationPathUtils,
} from "@ledgerhq/signer-utils";
import { Maybe } from "purify-ts";

import { type LegacyErrorConfig } from "@api/model/LegacyCoinProfile";
import {
  BTC_LEGACY_CLA,
  P1,
  P2,
} from "@internal/app-binder/command/utils/apduHeaderUtils";

const HASH_INPUT_FINALIZE_FULL_INS = 0x4a;

export type ProvideOutputFullChangePathCommandArgs = {
  readonly derivationPath: string;
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

  private readonly args: ProvideOutputFullChangePathCommandArgs;

  private readonly errorHelper: CommandErrorHelper<
    ProvideOutputFullChangePathCommandResponse,
    ErrorCodes
  >;

  constructor(
    args: ProvideOutputFullChangePathCommandArgs,
    errors: LegacyErrorConfig<ErrorCodes>,
  ) {
    this.args = args;
    this.errorHelper = new CommandErrorHelper(errors.errors, errors.factory);
  }

  getApdu(): Apdu {
    const provideOutputFullChangePathArgs: ApduBuilderArgs = {
      cla: BTC_LEGACY_CLA,
      ins: HASH_INPUT_FINALIZE_FULL_INS,
      p1: P1.CHANGE_PATH,
      p2: P2.DEFAULT,
    };

    const builder = new ApduBuilder(provideOutputFullChangePathArgs);

    const path = DerivationPathUtils.splitPath(this.args.derivationPath);
    builder.add8BitUIntToData(path.length);
    path.forEach((element) => {
      builder.add32BitUIntToData(element);
    });

    return builder.build();
  }

  parseResponse(
    apduResponse: ApduResponse,
  ): CommandResult<ProvideOutputFullChangePathCommandResponse, ErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(apduResponse),
    ).orDefault(CommandResultFactory({ data: apduResponse }));
  }
}
