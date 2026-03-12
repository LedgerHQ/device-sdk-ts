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

const CLA = 0xe0;
const INS = 0x02;
const P1 = 0x01;
const P2 = 0x00;

export type SendMetadataCommandArgs = {
  signedMetadata: Uint8Array;
};

export class SendMetadataCommand
  implements Command<void, SendMetadataCommandArgs, HyperliquidErrorCodes>
{
  readonly name = "sendMetadata";
  private readonly errorHelper = new CommandErrorHelper<
    void,
    HyperliquidErrorCodes
  >(HYPERLIQUID_ERRORS, HyperliquidCommandErrorFactory);

  constructor(readonly args: SendMetadataCommandArgs) {}

  getApdu(): Apdu {
    const sendMetadataArgs: ApduBuilderArgs = {
      cla: CLA,
      ins: INS,
      p1: P1,
      p2: P2,
    };

    return new ApduBuilder(sendMetadataArgs)
      .add8BitUIntToData(0x00)
      .encodeInLVFromBuffer(this.args.signedMetadata)
      .build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<void, HyperliquidErrorCodes> {
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
