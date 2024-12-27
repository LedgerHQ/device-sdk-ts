import {
  type Apdu,
  ApduBuilder,
  ApduParser,
  type ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";
import { CommandErrorHelper } from "@ledgerhq/signer-utils";
import { Maybe } from "purify-ts";

import { PROTOCOL_VERSION } from "@internal/app-binder/command/utils/constants";
import { BtcCommandUtils } from "@internal/utils/BtcCommandUtils";

import {
  BTC_APP_ERRORS,
  BtcAppCommandErrorFactory,
  type BtcErrorCodes,
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
    Command<
      GetWalletAddressCommandResponse,
      GetWalletAddressCommandArgs,
      BtcErrorCodes
    >
{
  constructor(
    private readonly args: GetWalletAddressCommandArgs,
    private readonly _errorHelper = new CommandErrorHelper<
      GetWalletAddressCommandResponse,
      BtcErrorCodes
    >(
      BTC_APP_ERRORS,
      BtcAppCommandErrorFactory,
      BtcCommandUtils.isSuccessResponse,
    ),
  ) {}

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
  ): CommandResult<GetWalletAddressCommandResponse, BtcErrorCodes> {
    return Maybe.fromNullable(
      this._errorHelper.getError(response),
    ).orDefaultLazy(() => {
      const parser = new ApduParser(response);
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
    });
  }
}
