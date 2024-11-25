import {
  type Apdu,
  ApduBuilder,
  ApduParser,
  type ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
  CommandUtils,
  GlobalCommandErrorHandler,
  InvalidStatusWordError,
  isCommandErrorCode,
} from "@ledgerhq/device-management-kit";

import { PROTOCOL_VERSION } from "@internal/app-binder/command/utils/constants";

import {
  BitcoinAppCommandError,
  bitcoinAppErrors,
} from "./utils/bitcoinAppErrors";

export type GetWalletAddressCommandResponse = {
  readonly address: string;
};

export type GetWalletAddressCommandArgs = {
  readonly display: boolean;
  readonly walletId: Uint8Array;
  readonly walletHmac: Uint8Array;
  readonly change: boolean;
  readonly addressIndex: number;
};

export class GetWalletAddressCommand
  implements
    Command<GetWalletAddressCommandResponse, GetWalletAddressCommandArgs>
{
  constructor(private readonly args: GetWalletAddressCommandArgs) {}

  getApdu(): Apdu {
    return new ApduBuilder({
      cla: 0xe1,
      ins: 0x03,
      p1: 0x00,
      p2: PROTOCOL_VERSION,
    })
      .addBufferToData(Uint8Array.from([this.args.display ? 1 : 0]))
      .addBufferToData(this.args.walletId)
      .addBufferToData(this.args.walletHmac)
      .addBufferToData(Uint8Array.from([this.args.change ? 1 : 0]))
      .add32BitUIntToData(this.args.addressIndex)
      .build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<GetWalletAddressCommandResponse> {
    const parser = new ApduParser(response);
    const errorCode = parser.encodeToHexaString(response.statusCode);
    if (isCommandErrorCode(errorCode, bitcoinAppErrors)) {
      return CommandResultFactory<GetWalletAddressCommandResponse>({
        error: new BitcoinAppCommandError({
          ...bitcoinAppErrors[errorCode],
          errorCode,
        }),
      });
    }

    if (!CommandUtils.isSuccessResponse(response)) {
      return CommandResultFactory({
        error: GlobalCommandErrorHandler.handle(response),
      });
    }

    if (response.data.length === 0) {
      return CommandResultFactory({
        error: new InvalidStatusWordError(
          "Failed to extract address from response",
        ),
      });
    }

    const address = parser.encodeToString(response.data);
    return CommandResultFactory({
      data: {
        address,
      },
    });
  }
}
