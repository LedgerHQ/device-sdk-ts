// https://github.com/LedgerHQ/app-ethereum/blob/develop/doc/ethapp.adoc#set-external-plugin
import {
  type Apdu,
  ApduBuilder,
  type ApduBuilderArgs,
  type ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
} from "@ledgerhq/device-management-kit";
import { CommandErrorHelper } from "@ledgerhq/signer-utils";
import { Maybe } from "purify-ts";

import {
  ETH_APP_ERRORS,
  EthAppCommandErrorFactory,
  type EthErrorCodes,
} from "./utils/ethAppErrors";

type SetExternalPluginCommandArgs = {
  payload: string;
  signature?: string;
};

export class SetExternalPluginCommand
  implements Command<void, SetExternalPluginCommandArgs, EthErrorCodes>
{
  readonly name = "setExternalPlugin";

  constructor(private readonly args: SetExternalPluginCommandArgs) {}
  private readonly errorHelper = new CommandErrorHelper<void, EthErrorCodes>(
    ETH_APP_ERRORS,
    EthAppCommandErrorFactory,
  );

  getApdu(): Apdu {
    const setExternalPluginBuilderArgs: ApduBuilderArgs = {
      cla: 0xe0,
      ins: 0x12,
      p1: 0x00,
      p2: 0x00,
    };
    return (
      new ApduBuilder(setExternalPluginBuilderArgs)
        .addHexaStringToData(this.args.payload)
        /**
         * The signature is normally integrated in the payload, but keeping this step for safety reasons and will be removed in the future.
         */
        .addHexaStringToData(this.args.signature ?? "")
        .build()
    );
  }

  parseResponse(
    apduResponse: ApduResponse,
  ): CommandResult<void, EthErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(apduResponse),
    ).orDefault(CommandResultFactory({ data: undefined }));
  }
}
