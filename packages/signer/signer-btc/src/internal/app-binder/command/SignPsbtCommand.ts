import {
  type Apdu,
  ApduBuilder,
  type ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
  GlobalCommandErrorHandler,
} from "@ledgerhq/device-management-kit";

import { PROTOCOL_VERSION } from "@internal/app-binder/command/utils/constants";
import { CommandUtils } from "@internal/utils/CommandUtils";

export type SignPsbtCommandArgs = {
  globalCommitments: Uint8Array;
  inputsCommitments: Uint8Array;
  outputsCommitments: Uint8Array;
  walletId: Uint8Array;
  walletHmac: Uint8Array;
};

type SignPsbtCommandResponse = void;

export class SignPsbtCommand
  implements Command<SignPsbtCommandResponse, SignPsbtCommandArgs>
{
  constructor(private _args: SignPsbtCommandArgs) {}

  getApdu(): Apdu {
    const builder = new ApduBuilder({
      cla: 0xe1,
      ins: 0x04,
      p1: 0x00,
      p2: PROTOCOL_VERSION,
    });
    const {
      globalCommitments,
      inputsCommitments,
      outputsCommitments,
      walletHmac,
      walletId,
    } = this._args;

    return builder
      .addBufferToData(globalCommitments)
      .addBufferToData(inputsCommitments)
      .addBufferToData(outputsCommitments)
      .addBufferToData(walletId)
      .addBufferToData(walletHmac)
      .build();
  }
  parseResponse(
    response: ApduResponse,
  ): CommandResult<SignPsbtCommandResponse> {
    if (!CommandUtils.isSuccessResponse(response)) {
      return CommandResultFactory({
        error: GlobalCommandErrorHandler.handle(response),
      });
    }
    return CommandResultFactory({
      data: undefined,
    });
  }
}
