// https://github.com/LedgerHQ/app-ethereum/blob/develop/doc/ethapp.adoc#set-plugin
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

export type SetPluginCommandArgs = {
  /**
   * The stringified hexa representation of the plugin signature.
   */
  payload: string;
};

export class SetPluginCommand
  implements Command<void, SetPluginCommandArgs, EthErrorCodes>
{
  readonly name = "setPlugin";
  private readonly errorHelper = new CommandErrorHelper<void, EthErrorCodes>(
    ETH_APP_ERRORS,
    EthAppCommandErrorFactory,
  );

  constructor(private readonly args: SetPluginCommandArgs) {}

  getApdu(): Apdu {
    const apduBuilderArgs: ApduBuilderArgs = {
      cla: 0xe0,
      ins: 0x16,
      p1: 0x00,
      p2: 0x00,
    };
    return new ApduBuilder(apduBuilderArgs)
      .addHexaStringToData(this.args.payload)
      .build();
  }

  parseResponse(response: ApduResponse): CommandResult<void, EthErrorCodes> {
    return Maybe.fromNullable(this.errorHelper.getError(response)).orDefault(
      CommandResultFactory({ data: undefined }),
    );
  }
}
