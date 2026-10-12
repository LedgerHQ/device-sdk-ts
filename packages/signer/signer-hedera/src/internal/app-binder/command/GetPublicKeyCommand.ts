import {
  type Apdu,
  ApduBuilder,
  type ApduBuilderArgs,
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
  HEDERA_CLA,
  INS,
  P1,
  P2_DEFAULT,
} from "@internal/app-binder/command/utils/apduHeaderUtils";
import {
  buildApduOrThrow,
  encodeKeyIndex,
} from "@internal/app-binder/command/utils/apduUtils";

import {
  HEDERA_APP_ERRORS,
  HederaAppCommandErrorFactory,
  type HederaErrorCodes,
} from "./utils/hederaApplicationErrors";

const PUBLIC_KEY_LENGTH = 32;

export type GetPublicKeyCommandArgs = {
  readonly keyIndex: number;
  readonly checkOnDevice: boolean;
};

export type GetPublicKeyCommandResponse = PublicKey;

export class GetPublicKeyCommand
  implements
    Command<
      GetPublicKeyCommandResponse,
      GetPublicKeyCommandArgs,
      HederaErrorCodes
    >
{
  readonly name = "GetPublicKey";
  private readonly errorHelper = new CommandErrorHelper<
    GetPublicKeyCommandResponse,
    HederaErrorCodes
  >(HEDERA_APP_ERRORS, HederaAppCommandErrorFactory);

  constructor(readonly args: GetPublicKeyCommandArgs) {}

  getApdu(): Apdu {
    const getPublicKeyArgs: ApduBuilderArgs = {
      cla: HEDERA_CLA,
      ins: INS.GET_PUBLIC_KEY,
      p1: this.args.checkOnDevice ? P1.CHECK_ON_DEVICE : P1.NO_CHECK,
      p2: P2_DEFAULT,
    };
    return buildApduOrThrow(
      new ApduBuilder(getPublicKeyArgs).addBufferToData(
        encodeKeyIndex(this.args.keyIndex),
      ),
    );
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<GetPublicKeyCommandResponse, HederaErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(response),
    ).orDefaultLazy(() => {
      const parser = new ApduParser(response);
      const publicKey = parser.extractFieldByLength(PUBLIC_KEY_LENGTH);

      if (publicKey === undefined) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("Cannot extract public key"),
        });
      }

      return CommandResultFactory({
        data: parser.encodeToHexaString(publicKey),
      });
    });
  }
}
