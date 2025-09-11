import {
  type Apdu,
  ApduBuilder,
  type ApduBuilderArgs,
  ApduParser,
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

export type TxSimulationOptInCommandResponse = {
  enabled: boolean;
};

/**
 * The command that trigger transaction simulation opt-in on device.
 */
export class TxSimulationOptInCommand
  implements Command<TxSimulationOptInCommandResponse, void, EthErrorCodes>
{
  private readonly errorHelper = new CommandErrorHelper<
    TxSimulationOptInCommandResponse,
    EthErrorCodes
  >(ETH_APP_ERRORS, EthAppCommandErrorFactory);

  constructor() {}

  getApdu(): Apdu {
    const apduBuilderArgs: ApduBuilderArgs = {
      cla: 0xe0,
      ins: 0x32,
      p1: 0x01,
      p2: 0x00,
    };

    return new ApduBuilder(apduBuilderArgs).build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<TxSimulationOptInCommandResponse, EthErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(response),
    ).orDefaultLazy(() => {
      const enabled = new ApduParser(response).extract8BitUInt();
      if (enabled === undefined) {
        return CommandResultFactory({ data: { enabled: false } });
      }
      return CommandResultFactory({ data: { enabled: enabled !== 0 } });
    });
  }
}
