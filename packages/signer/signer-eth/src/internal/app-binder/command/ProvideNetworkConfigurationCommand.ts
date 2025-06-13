// https://github.com/LedgerHQ/app-ethereum/blob/develop/doc/ethapp.adoc#provide-network-configuration
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

export type ProvideNetworkConfigurationCommandArgs = {
  /**
   * The network configuration data to provide in chunks
   */
  readonly data: Uint8Array;
  /**
   * If this is the first chunk of the network configuration
   */
  readonly isFirstChunk: boolean;
};

export class ProvideNetworkConfigurationCommand
  implements
    Command<void, ProvideNetworkConfigurationCommandArgs, EthErrorCodes>
{
  private readonly errorHelper = new CommandErrorHelper<void, EthErrorCodes>(
    ETH_APP_ERRORS,
    EthAppCommandErrorFactory,
  );

  constructor(private readonly args: ProvideNetworkConfigurationCommandArgs) {}

  getApdu(): Apdu {
    const provideNetworkConfigurationArgs: ApduBuilderArgs = {
      cla: 0xe0,
      ins: 0x30,
      p1: this.args.isFirstChunk ? 0x00 : 0x01,
      p2: 0x00,
    };

    return new ApduBuilder(provideNetworkConfigurationArgs)
      .addBufferToData(this.args.data)
      .build();
  }

  parseResponse(response: ApduResponse): CommandResult<void, EthErrorCodes> {
    return Maybe.fromNullable(this.errorHelper.getError(response)).orDefault(
      CommandResultFactory({ data: undefined }),
    );
  }
}
