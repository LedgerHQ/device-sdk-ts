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

import { INS, P1_DEFAULT, P2_DEFAULT, XRP_CLA } from "./utils/apduHeaderUtils";
import {
  XRP_APP_ERRORS,
  XrpAppCommandErrorFactory,
  type XrpErrorCodes,
} from "./utils/xrpApplicationErrors";

export type ProvideMptDescriptorCommandArgs = {
  /** Signed Token Dynamic Descriptor TLV, signature included. */
  readonly descriptor: Uint8Array;
};

/**
 * Gives the XRP app the ticker and scale of one MPT, for the next Sign
 * command only.
 */
export class ProvideMptDescriptorCommand
  implements Command<void, ProvideMptDescriptorCommandArgs, XrpErrorCodes>
{
  readonly name = "ProvideMptDescriptor";

  private readonly errorHelper = new CommandErrorHelper<void, XrpErrorCodes>(
    XRP_APP_ERRORS,
    XrpAppCommandErrorFactory,
  );

  constructor(private readonly args: ProvideMptDescriptorCommandArgs) {}

  getApdu(): Apdu {
    const provideMptDescriptorArgs: ApduBuilderArgs = {
      cla: XRP_CLA,
      ins: INS.PROVIDE_MPT_DESCRIPTOR,
      p1: P1_DEFAULT,
      p2: P2_DEFAULT,
    };

    return new ApduBuilder(provideMptDescriptorArgs)
      .addBufferToData(this.args.descriptor)
      .build();
  }

  parseResponse(
    apduResponse: ApduResponse,
  ): CommandResult<void, XrpErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(apduResponse),
    ).orDefault(CommandResultFactory({ data: undefined }));
  }
}
