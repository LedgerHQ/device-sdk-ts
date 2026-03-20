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

export type GetTrustedInputCommandArgs = {
  transaction: Uint8Array;
  indexLookup?: number;
};

export type GetTrustedInputCommandResponse = ApduResponse;

export class GetTrustedInputCommand
  implements
    Command<
      GetTrustedInputCommandResponse,
      GetTrustedInputCommandArgs,
      ZcashErrorCodes
    >
{
  readonly name = "GetTrustedInput";
  private readonly errorHelper = new CommandErrorHelper<
    GetTrustedInputCommandResponse,
    ZcashErrorCodes
  >(ZCASH_APP_ERRORS, ZcashAppCommandErrorFactory);
  private readonly args: GetTrustedInputCommandArgs;

  constructor(args: GetTrustedInputCommandArgs) {
    this.args = args;
  }

  getApdu(): Apdu {
    const { transaction, indexLookup } = this.args;

    let data: Uint8Array;
    let firstRound = false;

    if (typeof indexLookup === "number" && indexLookup > 0) {
      firstRound = true;
      const prefix = Buffer.alloc(4);
      prefix.writeUInt32BE(indexLookup, 0);
      data = Buffer.concat([prefix, transaction], transaction.length + 4);
    } else {
      data = transaction;
    }

    const getTrustedInputCommandArgs: ApduBuilderArgs = {
      cla: ZCASH_CLA,
      ins: INS.GET_TRUSTED_INPUT,
      p1: firstRound ? P1.FIRST : P1.NEXT,
      p2: P2.DEFAULT,
    };

    return new ApduBuilder(getTrustedInputCommandArgs)
      .addBufferToData(data)
      .build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<GetTrustedInputCommandResponse, ZcashErrorCodes> {
    return Maybe.fromNullable(this.errorHelper.getError(response)).orDefault(
      CommandResultFactory({ data: response }),
    );
  }
}
