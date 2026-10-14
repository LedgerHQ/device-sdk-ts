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

export type GetTrustedInputCommandArgs = {
  transaction: Uint8Array;
  indexLookup?: number;
};

export type GetTrustedInputCommandResponse = ApduResponse;

/**
 * The length of the prefix for the index lookup in bytes.
 */
export const INDEX_LOOKUP_PREFIX_LENGTH = 4;
const GET_TRUSTED_INPUT = 0x42;

export class LegacyGetTrustedInputCommand<ErrorCodes extends string>
  implements
    Command<
      GetTrustedInputCommandResponse,
      GetTrustedInputCommandArgs,
      ErrorCodes
    >
{
  readonly name = "GetTrustedInput";
  private readonly errorHelper: CommandErrorHelper<
    GetTrustedInputCommandResponse,
    ErrorCodes
  >;

  constructor(
    private readonly args: GetTrustedInputCommandArgs,
    errors: LegacyErrorConfig<ErrorCodes>,
  ) {
    this.errorHelper = new CommandErrorHelper(errors.errors, errors.factory);
  }

  getApdu(): Apdu {
    const { transaction, indexLookup } = this.args;

    let data: Uint8Array;
    let firstRound = false;

    if (typeof indexLookup === "number" && indexLookup >= 0) {
      firstRound = true;
      const prefix = new Uint8Array(INDEX_LOOKUP_PREFIX_LENGTH);
      new DataView(
        prefix.buffer,
        prefix.byteOffset,
        prefix.byteLength,
      ).setUint32(0, indexLookup, false);
      data = new Uint8Array(transaction.length + INDEX_LOOKUP_PREFIX_LENGTH);
      data.set(prefix, 0);
      data.set(transaction, INDEX_LOOKUP_PREFIX_LENGTH);
    } else {
      data = transaction;
    }

    const apduArgs: ApduBuilderArgs = {
      cla: BTC_LEGACY_CLA,
      ins: GET_TRUSTED_INPUT,
      p1: firstRound ? P1.FIRST : P1.NEXT,
      p2: P2.DEFAULT,
    };

    return new ApduBuilder(apduArgs).addBufferToData(data).build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<GetTrustedInputCommandResponse, ErrorCodes> {
    return Maybe.fromNullable(this.errorHelper.getError(response)).orDefault(
      CommandResultFactory({ data: response }),
    );
  }
}
