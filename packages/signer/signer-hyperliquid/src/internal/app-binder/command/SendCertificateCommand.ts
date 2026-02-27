import {
  type Apdu,
  ApduBuilder,
  type ApduBuilderArgs,
  type ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";
import { CommandErrorHelper } from "@ledgerhq/signer-utils";

import {
  HYPERLIQUID_ERRORS,
  HyperliquidCommandErrorFactory,
  type HyperliquidErrorCodes,
} from "./utils/hyperliquidApplicationErrors";

const CLA = 0xb0;
const INS = 0x06;
const P1 = 0x00;
const P2 = 0x00;

export type SendCertificateCommandArgs = {
  certificate: Uint8Array;
};

export class SendCertificateCommand
  implements Command<void, SendCertificateCommandArgs, HyperliquidErrorCodes>
{
  readonly name = "SendCertificate";
  private readonly errorHelper = new CommandErrorHelper<
    void,
    HyperliquidErrorCodes
  >(HYPERLIQUID_ERRORS, HyperliquidCommandErrorFactory);

  constructor(readonly args: SendCertificateCommandArgs) {}

  getApdu(): Apdu {
    const sendCertificateArgs: ApduBuilderArgs = {
      cla: CLA,
      ins: INS,
      p1: P1,
      p2: P2,
    };

    return new ApduBuilder(sendCertificateArgs)
      .addBufferToData(this.args.certificate)
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
        error: new InvalidStatusWordError("Unexpected data in response"),
      });
    }

    return CommandResultFactory({ data: undefined });
  }
}
