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
import {
  CommandErrorHelper,
  DerivationPathUtils,
} from "@ledgerhq/signer-utils";
import { Maybe } from "purify-ts";

import { type Signature } from "@api/model/Signature";

import {
  ZCASH_APP_ERRORS,
  ZcashAppCommandErrorFactory,
  type ZcashErrorCodes,
} from "./utils/zcashApplicationErrors";
import { INS, P1, P2, ZCASH_CLA } from "./utils/apduHeaderUtils";

const R_LENGTH = 32;
const S_LENGTH = 32;
const SIGN_MESSAGE_MAX_LENGTH = 0xffff;

export type SignMessageCommandArgs = {
  derivationPath: string;
  message: string | Uint8Array;
};

export type SignMessageCommandResponse = Signature;

export class SignMessageCommand
  implements
    Command<SignMessageCommandResponse, SignMessageCommandArgs, ZcashErrorCodes>
{
  readonly name = "SignMessage";

  private readonly args: SignMessageCommandArgs;
  private readonly errorHelper = new CommandErrorHelper<
    SignMessageCommandResponse,
    ZcashErrorCodes
  >(ZCASH_APP_ERRORS, ZcashAppCommandErrorFactory);

  constructor(args: SignMessageCommandArgs) {
    this.args = args;
  }

  getApdu(): Apdu {
    const { derivationPath, message } = this.args;
    const messageBytes =
      typeof message === "string" ? new TextEncoder().encode(message) : message;

    if (messageBytes.length > SIGN_MESSAGE_MAX_LENGTH) {
      throw new Error("Message length exceeds 65535 bytes");
    }

    const signMessageArgs: ApduBuilderArgs = {
      cla: ZCASH_CLA,
      ins: INS.SIGN_MESSAGE,
      p1: P1.FIRST,
      p2: P2.DEFAULT,
    };

    const path = DerivationPathUtils.splitPath(derivationPath);
    const builder = new ApduBuilder(signMessageArgs);
    builder.add8BitUIntToData(path.length);
    path.forEach((element) => {
      builder.add32BitUIntToData(element);
    });
    builder
      .add16BitUIntToData(messageBytes.length)
      .addBufferToData(messageBytes);

    return builder.build();
  }

  parseResponse(
    apduResponse: ApduResponse,
  ): CommandResult<SignMessageCommandResponse, ZcashErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(apduResponse),
    ).orDefaultLazy(() => {
      const parser = new ApduParser(apduResponse);
      const v = parser.extract8BitUInt();
      if (v === undefined) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("V is missing"),
        });
      }

      const r = parser.encodeToHexaString(
        parser.extractFieldByLength(R_LENGTH),
        true,
      );
      if (!r) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("R is missing"),
        });
      }

      const s = parser.encodeToHexaString(
        parser.extractFieldByLength(S_LENGTH),
        true,
      );
      if (!s) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("S is missing"),
        });
      }

      return CommandResultFactory({
        data: {
          v,
          r,
          s,
        },
      });
    });
  }
}
