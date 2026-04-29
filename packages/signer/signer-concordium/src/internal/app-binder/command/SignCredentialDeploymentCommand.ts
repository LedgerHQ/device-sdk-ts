import {
  type Apdu,
  ApduBuilder,
  ApduParser,
  type ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
} from "@ledgerhq/device-management-kit";
import { CommandErrorHelper } from "@ledgerhq/signer-utils";
import { Maybe } from "purify-ts";

import { type Signature } from "@api/model/Signature";
import {
  CONCORDIUM_APP_ERRORS,
  ConcordiumAppCommandErrorFactory,
  type ConcordiumErrorCodes,
} from "@internal/app-binder/command/utils/ConcordiumApplicationErrors";
import { INS, LEDGER_CLA } from "@internal/app-binder/constants";

export type SignCredentialDeploymentCommandArgs = {
  readonly p1: number;
  readonly p2: number;
  readonly data: Uint8Array;
};

export type SignCredentialDeploymentCommandResponse = Signature;

export class SignCredentialDeploymentCommand
  implements
    Command<
      SignCredentialDeploymentCommandResponse,
      SignCredentialDeploymentCommandArgs,
      ConcordiumErrorCodes
    >
{
  readonly name = "SignCredentialDeployment";

  private readonly args: SignCredentialDeploymentCommandArgs;

  private readonly errorHelper = new CommandErrorHelper<
    SignCredentialDeploymentCommandResponse,
    ConcordiumErrorCodes
  >(CONCORDIUM_APP_ERRORS, ConcordiumAppCommandErrorFactory);

  constructor(args: SignCredentialDeploymentCommandArgs) {
    this.args = args;
  }

  getApdu(): Apdu {
    const apduBuilder = new ApduBuilder({
      cla: LEDGER_CLA,
      ins: INS.SIGN_CREDENTIAL_DEPLOYMENT,
      p1: this.args.p1,
      p2: this.args.p2,
    });

    apduBuilder.addBufferToData(this.args.data);

    return apduBuilder.build();
  }

  parseResponse(
    apduResponse: ApduResponse,
  ): CommandResult<
    SignCredentialDeploymentCommandResponse,
    ConcordiumErrorCodes
  > {
    return Maybe.fromNullable(
      this.errorHelper.getError(apduResponse),
    ).orDefaultLazy(() => {
      const apduParser = new ApduParser(apduResponse);
      const remaining = apduParser.getUnparsedRemainingLength();
      const signature = apduParser.extractFieldByLength(remaining);

      return CommandResultFactory({
        data: signature as Signature,
      });
    });
  }
}
