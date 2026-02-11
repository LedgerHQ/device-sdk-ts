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

import { type Signature } from "@api/model/Signature";
import {
  KASPA_APP_ERRORS,
  KaspaAppCommandErrorFactory,
  type KaspaErrorCodes,
} from "./utils/kaspaAppErrors";

const CLA = 0xe0;
const INS_SIGN_MESSAGE = 0x07;

export type SignMessageCommandArgs = {
  message: Uint8Array | string;
  addressType?: number;
  addressIndex?: number;
  account?: number;
};

export type SignMessageCommandResponse = Signature;

export class SignMessageCommand
  implements Command<SignMessageCommandResponse, SignMessageCommandArgs, KaspaErrorCodes>
{
  readonly name = "SignMessage";

  private readonly _args: SignMessageCommandArgs;
  private readonly errorHelper = new CommandErrorHelper<
    SignMessageCommandResponse,
    KaspaErrorCodes
  >(KASPA_APP_ERRORS, KaspaAppCommandErrorFactory);

  constructor(args: SignMessageCommandArgs) {
    this._args = args;
  }

  getApdu(): Apdu {
    const {
      message,
      addressType = 0,
      addressIndex = 0,
      account = 0x80000000,
    } = this._args;

    const messageBytes =
      typeof message === "string" ? new TextEncoder().encode(message) : message;

    const builder = new ApduBuilder({
      cla: CLA,
      ins: INS_SIGN_MESSAGE,
      p1: 0x00,
      p2: 0x00,
    });

    builder.add8BitUIntToData(addressType);
    builder.add32BitUIntToData(addressIndex);
    builder.add32BitUIntToData(account);
    builder.add8BitUIntToData(messageBytes.length);
    builder.addBufferToData(messageBytes);

    return builder.build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<SignMessageCommandResponse, KaspaErrorCodes> {
    return Maybe.fromNullable(this.errorHelper.getError(response)).orDefaultLazy(
      () => {
        const parser = new ApduParser(response);
        const sigLen = parser.extract8BitUInt();

        if (sigLen === undefined || sigLen === 0) {
          return CommandResultFactory({
            error: new InvalidStatusWordError("Cannot extract signature length"),
          });
        }

        const signatureBytes = parser.extractFieldByLength(sigLen);
        if (signatureBytes === undefined) {
          return CommandResultFactory({
            error: new InvalidStatusWordError("Cannot extract signature"),
          });
        }

        const signature = Array.from(signatureBytes)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");

        return CommandResultFactory({
          data: { r: signature, s: "", v: undefined },
        });
      },
    );
  }
}
