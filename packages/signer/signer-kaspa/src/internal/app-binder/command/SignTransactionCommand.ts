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

import {
  KASPA_APP_ERRORS,
  KaspaAppCommandErrorFactory,
  type KaspaErrorCodes,
} from "./utils/kaspaAppErrors";

const CLA = 0xe0;
const INS_SIGN_TX = 0x06;
const P2_MORE = 0x80;
const P2_LAST = 0x00;

export type SignTransactionCommandArgs = {
  data: Uint8Array;
  p1: number;
  isLastChunk: boolean;
};

export type SignTransactionCommandResponse = {
  signature?: Uint8Array;
  hasMore?: boolean;
  inputIndex?: number;
};

export class SignTransactionCommand
  implements Command<SignTransactionCommandResponse, SignTransactionCommandArgs, KaspaErrorCodes>
{
  readonly name = "SignTransaction";

  private readonly _args: SignTransactionCommandArgs;
  private readonly errorHelper = new CommandErrorHelper<
    SignTransactionCommandResponse,
    KaspaErrorCodes
  >(KASPA_APP_ERRORS, KaspaAppCommandErrorFactory);

  constructor(args: SignTransactionCommandArgs) {
    this._args = args;
  }

  getApdu(): Apdu {
    const { data, p1, isLastChunk } = this._args;

    const builder = new ApduBuilder({
      cla: CLA,
      ins: INS_SIGN_TX,
      p1: p1,
      p2: isLastChunk ? P2_LAST : P2_MORE,
    });

    builder.addBufferToData(data);

    return builder.build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<SignTransactionCommandResponse, KaspaErrorCodes> {
    return Maybe.fromNullable(this.errorHelper.getError(response)).orDefaultLazy(
      () => {
        const parser = new ApduParser(response);
        const responseLength = parser.getUnparsedRemainingLength();

        if (responseLength > 0) {
          const hasMore = parser.extract8BitUInt();
          const inputIndex = parser.extract8BitUInt();
          const sigLen = parser.extract8BitUInt();

          if (sigLen !== undefined && sigLen > 0) {
            const signature = parser.extractFieldByLength(sigLen);
            return CommandResultFactory({
              data: {
                signature,
                hasMore: hasMore === 1,
                inputIndex,
              },
            });
          }
        }

        return CommandResultFactory({ data: {} });
      },
    );
  }
}
