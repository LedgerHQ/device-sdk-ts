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

import {
  INS,
  P1,
  P2,
  ZCASH_CLA,
} from "@internal/app-binder/command/utils/apduHeaderUtils";

import {
  ZCASH_APP_ERRORS,
  ZcashAppCommandErrorFactory,
  type ZcashErrorCodes,
} from "./utils/zcashApplicationErrors";

export type ProvideOutputFullChangePathCommandArgs = {
  derivationPath: string;
};

export type ProvideOutputFullChangePathCommandResponse = ApduResponse;

export class ProvideOutputFullChangePathCommand
  implements
    Command<
      ProvideOutputFullChangePathCommandResponse,
      ProvideOutputFullChangePathCommandArgs,
      ZcashErrorCodes
    >
{
  readonly name = "ProvideOutputFullChangePath";

  private readonly errorHelper = new CommandErrorHelper<
    ProvideOutputFullChangePathCommandResponse,
    ZcashErrorCodes
  >(ZCASH_APP_ERRORS, ZcashAppCommandErrorFactory);

  constructor(private readonly args: ProvideOutputFullChangePathCommandArgs) {}

  getApdu(): Apdu {
    const apduArgs: ApduBuilderArgs = {
      cla: ZCASH_CLA,
      ins: INS.FINALIZE_INPUT,
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
  ): CommandResult<
    ProvideOutputFullChangePathCommandResponse,
    ZcashErrorCodes
  > {
    return Maybe.fromNullable(this.errorHelper.getError(response)).orDefault(
      CommandResultFactory({ data: response }),
    );
  }
}
