// https://github.com/LedgerHQ/app-ethereum/blob/develop/doc/ethapp.adoc#sign-eth-personal-message
import {
  type Apdu,
  ApduBuilder,
  type ApduBuilderArgs,
  ApduParser,
  type ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
  CommandUtils,
  GlobalCommandErrorHandler,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";
import { Just, type Maybe, Nothing } from "purify-ts";

import { type Signature } from "@api/model/Signature";

const R_LENGTH = 32;
const S_LENGTH = 32;

export type SignPersonalMessageCommandArgs = {
  /**
   * The data to sign in max 150 bytes chunks
   */
  readonly data: Uint8Array;
  /**
   * If this is the first chunk of the message
   */
  readonly isFirstChunk: boolean;
};

export type SignPersonalMessageCommandResponse = Maybe<Signature>;

export class SignPersonalMessageCommand
  implements
    Command<SignPersonalMessageCommandResponse, SignPersonalMessageCommandArgs>
{
  readonly args: SignPersonalMessageCommandArgs;

  constructor(args: SignPersonalMessageCommandArgs) {
    this.args = args;
  }

  getApdu(): Apdu {
    const { data, isFirstChunk } = this.args;
    const signPersonalMessageArgs: ApduBuilderArgs = {
      cla: 0xe0,
      ins: 0x08,
      p1: isFirstChunk ? 0x00 : 0x80,
      p2: 0x00,
    };

    return new ApduBuilder(signPersonalMessageArgs)
      .addBufferToData(data)
      .build();
  }

  parseResponse(
    apduResponse: ApduResponse,
  ): CommandResult<SignPersonalMessageCommandResponse> {
    const parser = new ApduParser(apduResponse);

    if (!CommandUtils.isSuccessResponse(apduResponse)) {
      return CommandResultFactory({
        error: GlobalCommandErrorHandler.handle(apduResponse),
      });
    }

    // The data is returned only for the last chunk
    const v = parser.extract8BitUInt();
    if (v === undefined) {
      return CommandResultFactory({ data: Nothing });
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
      data: Just({
        r,
        s,
        v,
      }),
    });
  }
}
