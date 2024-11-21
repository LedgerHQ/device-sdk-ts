import {
  ApduBuilder,
  ApduParser,
  type ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
  CommandUtils,
  GlobalCommandErrorHandler,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";

import { PROTOCOL_VERSION } from "@internal/app-binder/command/utils/constants";

export type RegisterWalletAddressCommandArgs = {
  walletPolicy: Uint8Array;
};

type RegisterWalletAddressCommandResponse = {
  walletId: Uint8Array;
  walletHmac: Uint8Array;
};

const RESPONSE_BUFFER_LENGTH = 32;

export class RegisterWalletAddressCommand
  implements
    Command<
      RegisterWalletAddressCommandResponse,
      RegisterWalletAddressCommandArgs
    >
{
  constructor(private readonly _args: RegisterWalletAddressCommandArgs) {}

  getApdu() {
    const builder = new ApduBuilder({
      cla: 0xe1,
      ins: 0x02,
      p1: 0x00,
      p2: PROTOCOL_VERSION,
    });
    const { walletPolicy } = this._args;

    return builder.addBufferToData(walletPolicy).build();
  }
  parseResponse(
    response: ApduResponse,
  ): CommandResult<RegisterWalletAddressCommandResponse> {
    const parser = new ApduParser(response);

    if (!CommandUtils.isSuccessResponse(response)) {
      return CommandResultFactory({
        error: GlobalCommandErrorHandler.handle(response),
      });
    }
    const walletId = parser.extractFieldByLength(RESPONSE_BUFFER_LENGTH);
    const walletHmac = parser.extractFieldByLength(RESPONSE_BUFFER_LENGTH);
    if (!walletId || !walletHmac) {
      return CommandResultFactory({
        error: new InvalidStatusWordError("Data mismatch"),
      });
    }
    return CommandResultFactory({
      data: {
        walletId,
        walletHmac,
      },
    });
  }
}
