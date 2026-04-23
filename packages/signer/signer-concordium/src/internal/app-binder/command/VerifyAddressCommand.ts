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
import { encodeDerivationPath } from "@internal/app-binder/command/utils/EncodeDerivationPath";
import { INS, LEDGER_CLA, P1, P2 } from "@internal/app-binder/constants";

export type VerifyAddressCommandArgs = {
  readonly derivationPath: string;
};

export class VerifyAddressCommand
  implements Command<void, VerifyAddressCommandArgs, ConcordiumErrorCodes>
{
  readonly name = "VerifyAddress";

  private readonly errorHelper = new CommandErrorHelper<
    void,
    ConcordiumErrorCodes
  >(CONCORDIUM_APP_ERRORS, ConcordiumAppCommandErrorFactory);

  constructor(private readonly args: VerifyAddressCommandArgs) {}

  getApdu(): Apdu {
    const apduBuilder = new ApduBuilder({
      cla: LEDGER_CLA,
      ins: INS.VERIFY_ADDRESS,
      p1: P1.FULL_PATH,
      p2: P2.NONE,
    });

    const encodedPath = encodeDerivationPath(this.args.derivationPath);
    apduBuilder.addBufferToData(encodedPath);

    return apduBuilder.build();
  }

  parseResponse(
    apduResponse: ApduResponse,
  ): CommandResult<void, ConcordiumErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(apduResponse),
    ).orDefault(CommandResultFactory({ data: undefined }));
  }
}
