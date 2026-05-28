import {
  Apdu,
  type ApduResponse,
  ByteArrayBuilder,
  type Command,
  type CommandResult,
  CommandResultFactory,
  InvalidResponseFormatError,
} from "@ledgerhq/device-management-kit";
import { CommandErrorHelper } from "@ledgerhq/signer-utils";

import {
  HYPERLIQUID_ERRORS,
  HyperliquidCommandErrorFactory,
  type HyperliquidErrorCodes,
} from "./utils/hyperliquidApplicationErrors";

/** Set action to sign — APDU CLA/INS per specs.md */
const CLA = 0xe0;
const INS = 0x03;
const P1 = 0x01;
const P2 = 0x00;

export type SendActionCommandArgs = {
  /** TLV-serialized action (specs.md "Set action to sign" data format) */
  serializedAction: Uint8Array;
};

export type SendActionCommandResponse = void;

export class SendActionCommand
  implements
    Command<
      SendActionCommandResponse,
      SendActionCommandArgs,
      HyperliquidErrorCodes
    >
{
  readonly name = "sendAction";

  private readonly errorHelper = new CommandErrorHelper<
    SendActionCommandResponse,
    HyperliquidErrorCodes
  >(HYPERLIQUID_ERRORS, HyperliquidCommandErrorFactory);

  constructor(readonly args: SendActionCommandArgs) {}

  getApdu(): Apdu {
    const builder = new ByteArrayBuilder().add8BitUIntToData(0x00);

    const payload = this.args.serializedAction;
    const length = payload.length;
    if (length < 0x80) {
      builder.add8BitUIntToData(length);
    } else if (length <= 0xff) {
      builder.add8BitUIntToData(0x81);
      builder.add8BitUIntToData(length);
    } else {
      builder.add8BitUIntToData(0x82);
      builder.add16BitUIntToData(length);
    }
    builder.addBufferToData(payload);

    return new Apdu(CLA, INS, P1, P2, builder.build());
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<SendActionCommandResponse, HyperliquidErrorCodes> {
    const error = this.errorHelper.getError(response);
    if (error) {
      return error;
    }

    if (response.data.length !== 0) {
      return CommandResultFactory({
        error: new InvalidResponseFormatError("Unexpected data in response"),
      });
    }

    return CommandResultFactory({ data: undefined });
  }
}
