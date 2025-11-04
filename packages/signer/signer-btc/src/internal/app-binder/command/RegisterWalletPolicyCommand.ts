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
import { BtcCommandUtils } from "@internal/utils/BtcCommandUtils";
import { encodeVarint } from "@internal/utils/Varint";

export type RegisterWalletPolicyCommandArgs = {
  walletPolicy: Uint8Array;
};

type RegisterWalletPolicyCommandResponse = ApduResponse;

export class RegisterWalletPolicyCommand
  implements
    Command<
      RegisterWalletPolicyCommandResponse,
      RegisterWalletPolicyCommandArgs,
      BtcErrorCodes
    >
{
  constructor(
    private readonly _args: RegisterWalletPolicyCommandArgs,
    private readonly _errorHelper = new CommandErrorHelper<
      RegisterWalletPolicyCommandResponse,
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
      p2: 0x00,
    });
    const { walletPolicy } = this._args;

    const apdu = builder
      .addBufferToData(encodeVarint(walletPolicy.length).unsafeCoerce())
      .addBufferToData(walletPolicy)
      .build();

    return apdu;
  }

  parseResponse(
    apduResponse: ApduResponse,
  ): CommandResult<RegisterWalletPolicyCommandResponse, BtcErrorCodes> {
    return Maybe.fromNullable(
      this._errorHelper.getError(apduResponse),
    ).orDefault(CommandResultFactory({ data: apduResponse }));
  }
}
