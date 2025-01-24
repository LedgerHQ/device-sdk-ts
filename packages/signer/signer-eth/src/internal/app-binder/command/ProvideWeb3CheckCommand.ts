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
} from "@internal/app-binder/command/utils/ethAppErrors";

export type ProvideWeb3CheckCommandArgs = {
  payload: string;
};

/**
 * The command that provides a chunk of the trusted name to the device.
 */
export class ProvideWeb3CheckCommand
  implements Command<void, ProvideWeb3CheckCommandArgs, EthErrorCodes>
{
  private readonly errorHelper = new CommandErrorHelper<void, EthErrorCodes>(
    ETH_APP_ERRORS,
    EthAppCommandErrorFactory,
  );

  constructor(private readonly args: ProvideWeb3CheckCommandArgs) {}

  getApdu(): Apdu {
    const apduBuilderArgs: ApduBuilderArgs = {
      cla: 0xe0,
      ins: 0x32,
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
