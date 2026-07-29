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
 * `INS_PCZT_IRONWOOD_ACTION`: streams the Ironwood action bundle for V6
 * transactions (NU6.3). Mirrors `LedgerHQ/app-zcash` `src/consts.rs`.
 */
export const INS_PCZT_IRONWOOD_ACTION = 0x58;

export type PcztIronwoodActionCommandArgs = {
  /** One serialized packet of the Ironwood action bundle. */
  data: Uint8Array;
  /** Packet framing: `PCZT_P1.FIRST` / `NEXT` / `LAST`. */
  p1: number;
  /**
   * Bundle framing: `PCZT_P2.CONTINUE`, or `PCZT_P2.FINISHED` on the very last
   * packet to finalize the PCZT (after which signing commands are accepted).
   */
  p2: number;
};

/**
 * `PCZT_IRONWOOD_ACTION` (`INS 0x58`): streams one packet of the Ironwood
 * action bundle for V6 transactions. The last packet carries
 * `PCZT_P2.FINISHED`. Empty response.
 */
export class PcztIronwoodActionCommand
  implements Command<void, PcztIronwoodActionCommandArgs, ZcashErrorCodes>
{
  readonly name = "PcztIronwoodAction";

  private readonly errorHelper = new CommandErrorHelper<void, ZcashErrorCodes>(
    ZCASH_APP_ERRORS,
    ZcashAppCommandErrorFactory,
  );

  constructor(private readonly args: PcztIronwoodActionCommandArgs) {}

  getApdu(): Apdu {
    const apduArgs: ApduBuilderArgs = {
      cla: ZCASH_CLA,
      ins: INS_PCZT_IRONWOOD_ACTION,
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
