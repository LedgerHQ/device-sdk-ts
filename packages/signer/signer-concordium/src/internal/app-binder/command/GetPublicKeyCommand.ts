import {
  type Apdu,
  ApduBuilder,
  ApduParser,
  type ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";
import { CommandErrorHelper } from "@ledgerhq/signer-utils";
import { Maybe } from "purify-ts";

import { type PublicKey } from "@api/model/PublicKey";
import {
  CONCORDIUM_APP_ERRORS,
  ConcordiumAppCommandErrorFactory,
  type ConcordiumErrorCodes,
} from "@internal/app-binder/command/utils/ConcordiumApplicationErrors";
import { encodeDerivationPath } from "@internal/app-binder/command/utils/EncodeDerivationPath";
import { INS, LEDGER_CLA, P1, P2 } from "@internal/app-binder/constants";

const PUBLIC_KEY_LENGTH = 32;

export type GetPublicKeyCommandArgs = {
  readonly derivationPath: string;
  readonly checkOnDevice: boolean;
  readonly skipOpenApp: boolean;
};

export type GetPublicKeyCommandResponse = PublicKey;

export class GetPublicKeyCommand
  implements
    Command<
      GetPublicKeyCommandResponse,
      GetPublicKeyCommandArgs,
      ConcordiumErrorCodes
    >
{
  readonly name = "GetPublicKey";

  private readonly args: GetPublicKeyCommandArgs;

  private readonly errorHelper = new CommandErrorHelper<
    GetPublicKeyCommandResponse,
    ConcordiumErrorCodes
  >(CONCORDIUM_APP_ERRORS, ConcordiumAppCommandErrorFactory);

  constructor(args: GetPublicKeyCommandArgs) {
    this.args = args;
  }

  getApdu(): Apdu {
    const apduBuilder = new ApduBuilder({
      cla: LEDGER_CLA,
      ins: INS.GET_PUBLIC_KEY,
      p1: this.args.checkOnDevice ? P1.CONFIRM : P1.NON_CONFIRM,
      p2: P2.NONE,
    });

    const encodedPath = encodeDerivationPath(this.args.derivationPath);
    apduBuilder.addBufferToData(encodedPath);

    return apduBuilder.build();
  }

  parseResponse(
    apduResponse: ApduResponse,
  ): CommandResult<GetPublicKeyCommandResponse, ConcordiumErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(apduResponse),
    ).orDefaultLazy(() => {
      const apduParser = new ApduParser(apduResponse);
      const publicKey = apduParser.extractFieldByLength(PUBLIC_KEY_LENGTH);

      if (publicKey === undefined) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("Public key is missing"),
        });
      }

      return CommandResultFactory({
        data: { publicKey },
      });
    });
  }
}
