import {
  type CommandResult,
  type InternalApi,
} from "@ledgerhq/device-management-kit";

import { ProvideNetworkConfigurationCommand } from "@internal/app-binder/command/ProvideNetworkConfigurationCommand";
import { type EthErrorCodes } from "@internal/app-binder/command/utils/ethAppErrors";

import { SendCommandInChunksTask } from "./SendCommandInChunksTask";

export type ProvideNetworkConfigurationTaskArgs = {
  /**
   * The network configuration data to provide
   */
  data: Uint8Array;
};

/**
 * This task is responsible for providing network configuration to the device.
 * It will send the network configuration data in chunks using the ProvideNetworkConfigurationCommand.
 */
export class ProvideNetworkConfigurationTask {
  constructor(
    private api: InternalApi,
    private args: ProvideNetworkConfigurationTaskArgs,
  ) {}

  async run(): Promise<CommandResult<void, EthErrorCodes>> {
    return new SendCommandInChunksTask(this.api, {
      data: this.args.data,
      commandFactory: (args) =>
        new ProvideNetworkConfigurationCommand({
          data: args.chunkedData,
          isFirstChunk: args.isFirstChunk,
        }),
    }).run();
  }
}