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
import {
  type ChunkableCommandArgs,
  CommandErrorHelper,
} from "@ledgerhq/signer-utils";

import {
  HYPERLIQUID_ERRORS,
  HyperliquidCommandErrorFactory,
  type HyperliquidErrorCodes,
} from "./utils/hyperliquidApplicationErrors";

/** SET_ACTION — APDU framing per app-hyperliquid APP_SPECIFICATION.md */
const CLA = 0xe0;
const INS = 0x03;
const P1_FIRST_CHUNK = 0x01;
const P1_FOLLOWING_CHUNK = 0x00;
const P2 = 0x00;

export type SendActionCommandArgs = ChunkableCommandArgs;

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
    const p1 = this.args.extend ? P1_FOLLOWING_CHUNK : P1_FIRST_CHUNK;

    const sendActionArgs: ApduBuilderArgs = {
      cla: CLA,
      ins: INS,
      p1,
      p2: P2,
    };

    return new ApduBuilder(sendActionArgs)
      .addBufferToData(this.args.chunkedData)
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
