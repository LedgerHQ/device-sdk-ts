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

export type ProvideTxSimulationCommandArgs = {
  readonly payload: Uint8Array;
  readonly isFirstChunk: boolean;
};

/**
 * The command that provides a chunk of the transaction simulation to the device.
 */
export class ProvideTxSimulationCommand
  implements Command<void, ProvideTxSimulationCommandArgs, EthErrorCodes>
{
  private readonly errorHelper = new CommandErrorHelper<void, EthErrorCodes>(
    ETH_APP_ERRORS,
    EthAppCommandErrorFactory,
  );

  constructor(private readonly args: ProvideTxSimulationCommandArgs) {}

  getApdu(): Apdu {
    const apduBuilderArgs: ApduBuilderArgs = {
      cla: 0xe0,
      ins: 0x32,
      p1: 0x00,
      p2: this.args.isFirstChunk ? 0x01 : 0x00,
    };

    return new ApduBuilder(apduBuilderArgs)
      .addBufferToData(this.args.payload)
      .build();
  }

  parseResponse(response: ApduResponse): CommandResult<void, EthErrorCodes> {
    return Maybe.fromNullable(this.errorHelper.getError(response)).orDefault(
      CommandResultFactory({ data: undefined }),
    );
  }
}
