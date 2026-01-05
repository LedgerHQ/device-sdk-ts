import {
  ApduBuilder,
  type ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
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

type RegisterWalletAddressCommandResponse = ApduResponse;

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

    return builder.encodeInLVFromBuffer(walletPolicy).build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<RegisterWalletAddressCommandResponse, BtcErrorCodes> {
    return Maybe.fromNullable(this._errorHelper.getError(response)).orDefault(
      CommandResultFactory({ data: response }),
    );
  }
}
