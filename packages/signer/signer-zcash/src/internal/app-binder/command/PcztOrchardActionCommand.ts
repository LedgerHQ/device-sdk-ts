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
  PCZT_INS,
  ZCASH_CLA,
} from "@internal/app-binder/command/utils/apduHeaderUtils";
import {
  ZCASH_APP_ERRORS,
  ZcashAppCommandErrorFactory,
  type ZcashErrorCodes,
} from "@internal/app-binder/command/utils/zcashApplicationErrors";

export type PcztOrchardActionCommandArgs = {
  /** One serialized packet of the Orchard action bundle. */
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
 * `PCZT_ORCHARD_ACTION` (`INS 0x56`): streams one packet of the Orchard action
 * bundle. Always sent (count `0` when empty); the last packet carries
 * `PCZT_P2.FINISHED`. Empty response.
 */
export class PcztOrchardActionCommand
  implements Command<void, PcztOrchardActionCommandArgs, ZcashErrorCodes>
{
  readonly name = "PcztOrchardAction";

  private readonly errorHelper = new CommandErrorHelper<void, ZcashErrorCodes>(
    ZCASH_APP_ERRORS,
    ZcashAppCommandErrorFactory,
  );

  constructor(private readonly args: PcztOrchardActionCommandArgs) {}

  getApdu(): Apdu {
    const apduArgs: ApduBuilderArgs = {
      cla: ZCASH_CLA,
      ins: PCZT_INS.ORCHARD_ACTION,
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
