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

export type PcztTransparentInputCommandArgs = {
  /** One serialized packet of the transparent-input bundle. */
  data: Uint8Array;
  /** Packet framing: `PCZT_P1.FIRST` / `NEXT` / `LAST`. */
  p1: number;
  /** Bundle framing: `PCZT_P2.CONTINUE`. */
  p2: number;
};

/**
 * `PCZT_TRANSPARENT_INPUT` (`INS 0x53`): streams one packet of the transparent
 * input bundle. Always sent (count `0` when empty). Empty response.
 */
export class PcztTransparentInputCommand
  implements Command<void, PcztTransparentInputCommandArgs, ZcashErrorCodes>
{
  readonly name = "PcztTransparentInput";

  private readonly errorHelper = new CommandErrorHelper<void, ZcashErrorCodes>(
    ZCASH_APP_ERRORS,
    ZcashAppCommandErrorFactory,
  );

  constructor(private readonly args: PcztTransparentInputCommandArgs) {}

  getApdu(): Apdu {
    const apduArgs: ApduBuilderArgs = {
      cla: ZCASH_CLA,
      ins: PCZT_INS.TRANSPARENT_INPUT,
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
