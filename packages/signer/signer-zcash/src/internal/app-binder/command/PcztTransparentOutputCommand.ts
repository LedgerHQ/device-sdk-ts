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

import { ZCASH_CLA } from "@internal/app-binder/command/utils/apduHeaderUtils";
import {
  ZCASH_APP_ERRORS,
  ZcashAppCommandErrorFactory,
  type ZcashErrorCodes,
} from "@internal/app-binder/command/utils/zcashApplicationErrors";

/**
 * `INS_PCZT_TRANSPARENT_OUTPUT`: streams the transparent output bundle (always
 * sent, count 0 when empty). Mirrors `LedgerHQ/app-zcash` `src/consts.rs`.
 */
export const INS_PCZT_TRANSPARENT_OUTPUT = 0x54;

export type PcztTransparentOutputCommandArgs = {
  /** One serialized packet of the transparent-output bundle. */
  data: Uint8Array;
  /** Packet framing: `PCZT_P1.FIRST` / `NEXT` / `LAST`. */
  p1: number;
  /** Bundle framing: `PCZT_P2.CONTINUE`. */
  p2: number;
};

/**
 * `PCZT_TRANSPARENT_OUTPUT` (`INS 0x54`): streams one packet of the transparent
 * output bundle. Always sent (count `0` when empty). Empty response.
 */
export class PcztTransparentOutputCommand
  implements Command<void, PcztTransparentOutputCommandArgs, ZcashErrorCodes>
{
  readonly name = "PcztTransparentOutput";

  private readonly errorHelper = new CommandErrorHelper<void, ZcashErrorCodes>(
    ZCASH_APP_ERRORS,
    ZcashAppCommandErrorFactory,
  );

  constructor(private readonly args: PcztTransparentOutputCommandArgs) {}

  getApdu(): Apdu {
    const apduArgs: ApduBuilderArgs = {
      cla: ZCASH_CLA,
      ins: INS_PCZT_TRANSPARENT_OUTPUT,
      p1: this.args.p1,
      p2: this.args.p2,
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
