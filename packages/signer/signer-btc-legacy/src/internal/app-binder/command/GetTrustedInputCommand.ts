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

const GET_TRUSTED_INPUT_INS = 0x42;

export type GetTrustedInputCommandArgs = {
  readonly data: Uint8Array;
  // Set on the first chunk of a previous transaction only.
  readonly indexLookup?: number;
};

export type GetTrustedInputCommandResponse = ApduResponse;

export class LegacyGetTrustedInputCommand<ErrorCodes extends string>
  implements
    Command<
      GetTrustedInputCommandResponse,
      GetTrustedInputCommandArgs,
      ErrorCodes
    >
{
  readonly name = "GetTrustedInput";

  private readonly args: GetTrustedInputCommandArgs;

  private readonly errorHelper: CommandErrorHelper<
    GetTrustedInputCommandResponse,
    ErrorCodes
  >;

  constructor(
    args: GetTrustedInputCommandArgs,
    errors: LegacyErrorConfig<ErrorCodes>,
  ) {
    this.args = args;
    this.errorHelper = new CommandErrorHelper(errors.errors, errors.factory);
  }

  getApdu(): Apdu {
    const { data, indexLookup } = this.args;
    const firstRound = indexLookup !== undefined;

    const getTrustedInputArgs: ApduBuilderArgs = {
      cla: BTC_LEGACY_CLA,
      ins: GET_TRUSTED_INPUT_INS,
      p1: firstRound ? P1.FIRST : P1.NEXT,
      p2: P2.DEFAULT,
    };

    const builder = new ApduBuilder(getTrustedInputArgs);
    if (firstRound) {
      builder.add32BitUIntToData(indexLookup);
    }
    return builder.addBufferToData(data).build();
  }

  parseResponse(
    apduResponse: ApduResponse,
  ): CommandResult<GetTrustedInputCommandResponse, ErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(apduResponse),
    ).orDefault(CommandResultFactory({ data: apduResponse }));
  }
}
