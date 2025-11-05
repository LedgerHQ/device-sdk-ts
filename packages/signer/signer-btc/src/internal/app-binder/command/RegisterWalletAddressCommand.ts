import {
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

import {
  BTC_APP_ERRORS,
  BtcAppCommandErrorFactory,
  type BtcErrorCodes,
} from "@internal/app-binder/command/utils/bitcoinAppErrors";
import { PROTOCOL_VERSION } from "@internal/app-binder/command/utils/constants";
import { BtcCommandUtils } from "@internal/utils/BtcCommandUtils";

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
      RegisterWalletAddressCommandArgs,
      BtcErrorCodes
    >
{
  readonly name = "registerWalletAddress";
  constructor(
    private readonly _args: RegisterWalletAddressCommandArgs,
    private readonly _errorHelper = new CommandErrorHelper<
      RegisterWalletAddressCommandResponse,
      BtcErrorCodes
    >(
      BTC_APP_ERRORS,
      BtcAppCommandErrorFactory,
      BtcCommandUtils.isSuccessResponse,
    ),
  ) {}

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
  ): CommandResult<RegisterWalletAddressCommandResponse, BtcErrorCodes> {
    return Maybe.fromNullable(
      this._errorHelper.getError(response),
    ).orDefaultLazy(() => {
      const parser = new ApduParser(response);

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
    });
  }
}
