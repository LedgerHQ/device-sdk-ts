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
  PCZT_P1,
  PCZT_P2,
  ZCASH_CLA,
} from "@internal/app-binder/command/utils/apduHeaderUtils";
import {
  ZCASH_APP_ERRORS,
  ZcashAppCommandErrorFactory,
  type ZcashErrorCodes,
} from "@internal/app-binder/command/utils/zcashApplicationErrors";

/**
 * `INS_PCZT_HEADER`: resets the tx context and opens a new PCZT payload. Sent
 * exactly once. Mirrors `LedgerHQ/app-zcash` `src/consts.rs`.
 */
export const INS_PCZT_HEADER = 0x52;

export type PcztHeaderCommandArgs = {
  /** Serialized `PCZT_HEADER` payload (magic + version + `common::Global`). */
  data: Uint8Array;
};

/** `PCZT_HEADER` (`INS 0x52`): opens a new PCZT payload. Empty response. */
export class PcztHeaderCommand
  implements Command<void, PcztHeaderCommandArgs, ZcashErrorCodes>
{
  readonly name = "PcztHeader";

  private readonly errorHelper = new CommandErrorHelper<void, ZcashErrorCodes>(
    ZCASH_APP_ERRORS,
    ZcashAppCommandErrorFactory,
  );

  constructor(private readonly args: PcztHeaderCommandArgs) {}

  getApdu(): Apdu {
    const apduArgs: ApduBuilderArgs = {
      cla: ZCASH_CLA,
      ins: INS_PCZT_HEADER,
      p1: PCZT_P1.FIRST,
      p2: PCZT_P2.CONTINUE,
    };
    return new ApduBuilder(apduArgs).addBufferToData(this.args.data).build();
  }

  parseResponse(
    apduResponse: ApduResponse,
  ): CommandResult<void, ZcashErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(apduResponse),
    ).orDefault(CommandResultFactory({ data: undefined }));
  }
}
