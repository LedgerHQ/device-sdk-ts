import {
  type Apdu,
  ApduBuilder,
  type ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
} from "@ledgerhq/device-management-kit";
import { CommandErrorHelper } from "@ledgerhq/signer-utils";
import { Maybe } from "purify-ts";

import {
  CONCORDIUM_APP_ERRORS,
  ConcordiumAppCommandErrorFactory,
  type ConcordiumErrorCodes,
} from "@internal/app-binder/command/utils/ConcordiumApplicationErrors";
import { INS, LEDGER_CLA, P2 } from "@internal/app-binder/constants";

export type SetTrustedNameCommandArgs = {
  readonly payload: Uint8Array;
};

export class SetTrustedNameCommand
  implements Command<void, SetTrustedNameCommandArgs, ConcordiumErrorCodes>
{
  readonly name = "SetTrustedName";

  private readonly errorHelper = new CommandErrorHelper<
    void,
    ConcordiumErrorCodes
  >(CONCORDIUM_APP_ERRORS, ConcordiumAppCommandErrorFactory);

  constructor(private readonly args: SetTrustedNameCommandArgs) {}

  getApdu(): Apdu {
    return new ApduBuilder({
      cla: LEDGER_CLA,
      ins: INS.SET_TRUSTED_NAME,
      p1: 0x00,
      p2: P2.NONE,
    })
      .addBufferToData(this.args.payload)
      .build();
  }

  parseResponse(
    apduResponse: ApduResponse,
  ): CommandResult<void, ConcordiumErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(apduResponse),
    ).orDefault(CommandResultFactory({ data: undefined }));
  }
}
