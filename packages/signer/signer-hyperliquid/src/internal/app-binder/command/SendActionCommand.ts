import {
  type Apdu,
  ApduBuilder,
  type ApduBuilderArgs,
  type ApduResponse,
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
    const sendActionArgs: ApduBuilderArgs = {
      cla: CLA,
      ins: INS,
      p1: P1,
      p2: P2,
    };

    return new ApduBuilder(sendActionArgs)
      .add8BitUIntToData(0x00)
      .encodeInLVFromBuffer(this.args.serializedAction)
      .build();
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
