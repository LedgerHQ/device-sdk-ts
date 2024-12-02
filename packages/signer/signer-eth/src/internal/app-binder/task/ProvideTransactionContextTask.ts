import {
  type ClearSignContextSuccess,
  ClearSignContextType,
} from "@ledgerhq/context-module";
import {
  type CommandErrorResult,
  type CommandResult,
  CommandResultFactory,
  type InternalApi,
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { Just, type Maybe, Nothing } from "purify-ts";

import {
  ProvideNFTInformationCommand,
  type ProvideNFTInformationCommandErrorCodes,
} from "@internal/app-binder/command/ProvideNFTInformationCommand";
import {
  ProvideTokenInformationCommand,
  type ProvideTokenInformationCommandResponse,
} from "@internal/app-binder/command/ProvideTokenInformationCommand";
import { ProvideTrustedNameCommand } from "@internal/app-binder/command/ProvideTrustedNameCommand";
import {
  SetExternalPluginCommand,
  type SetExternalPluginCommandErrorCodes,
} from "@internal/app-binder/command/SetExternalPluginCommand";
import {
  SetPluginCommand,
  type SetPluginCommandErrorCodes,
} from "@internal/app-binder/command/SetPluginCommand";
import { PayloadUtils } from "@internal/shared/utils/PayloadUtils";

import {
  SendCommandInChunksTask,
  type SendCommandInChunksTaskArgs,
} from "./SendCommandInChunksTask";

export type ProvideTransactionContextTaskArgs = {
  /**
   * The valid clear sign contexts offerred by the `BuildTrancationContextTask`.
   */
  clearSignContexts: ClearSignContextSuccess[];
};

export type ProvideTransactionContextTaskErrorCodes =
  | void
  | SetExternalPluginCommandErrorCodes
  | SetPluginCommandErrorCodes
  | ProvideNFTInformationCommandErrorCodes;

/**
 * This task is responsible for providing the transaction context to the device.
 * It will send the 5 necessary commands:
 * - `SetPluginCommand` (single command)
 * - `SetExternalPluginCommand` (single command)
 * - `ProvideNFTInformationCommand` (single command)
 * - `ProvideTokenInformationCommand` (single command)
 * - `ProvideTrustedNameCommand` (__mulpitle commands__)
 *
 * The method `provideTrustedNameTask` is dedicated to send the multiple `ProvideTrustedNameCommand`.
 */
export class ProvideTransactionContextTask {
  constructor(
    private api: InternalApi,
    private args: ProvideTransactionContextTaskArgs,
  ) {}

  async run(): Promise<
    Maybe<CommandErrorResult<ProvideTransactionContextTaskErrorCodes>>
  > {
    for (const context of this.args.clearSignContexts) {
      const res = await this.provideContext(context);
      if (!isSuccessCommandResult(res)) {
        return Just(res);
      }
    }
    return Nothing;
  }

  /**
   * This method will send a command according to the clear sign context type and return the command result if only one command
   * is sent, otherwise it will return the result of the `provideTrustedNameTask`.
   *
   * @param context The clear sign context to provide.
   * @returns A promise that resolves when the command is sent or result of the `provideTrustedNameTask`.
   */
  async provideContext({
    type,
    payload,
  }: ClearSignContextSuccess): Promise<
    CommandResult<
      void | ProvideTokenInformationCommandResponse,
      ProvideTransactionContextTaskErrorCodes
    >
  > {
    switch (type) {
      case ClearSignContextType.PLUGIN: {
        return await this.api.sendCommand(new SetPluginCommand({ payload }));
      }
      case ClearSignContextType.EXTERNAL_PLUGIN: {
        return await this.api.sendCommand(
          new SetExternalPluginCommand({ payload }),
        );
      }
      case ClearSignContextType.NFT: {
        return await this.api.sendCommand(
          new ProvideNFTInformationCommand({ payload }),
        );
      }
      case ClearSignContextType.TOKEN: {
        return await this.api.sendCommand(
          new ProvideTokenInformationCommand({ payload }),
        );
      }
      case ClearSignContextType.TRUSTED_NAME: {
        return this.sendInChunks(
          payload,
          (args) =>
            new ProvideTrustedNameCommand({
              data: args.chunkedData,
              isFirstChunk: args.isFirstChunk,
            }),
        );
      }
      case ClearSignContextType.ENUM:
      case ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION:
      case ClearSignContextType.TRANSACTION_INFO: {
        return CommandResultFactory({
          error: new InvalidStatusWordError(
            "The context type [EXTERNAL_PLUGIN] is not valid here",
          ),
        });
      }
      default: {
        const uncoveredType: never = type;
        return CommandResultFactory({
          error: new InvalidStatusWordError(
            `The context type [${uncoveredType}] is not covered`,
          ),
        });
      }
    }
  }

  private async sendInChunks<T>(
    payload: string,
    commandFactory: SendCommandInChunksTaskArgs<T>[`commandFactory`],
  ): Promise<CommandResult<T, void>> {
    const data = PayloadUtils.getBufferFromPayload(payload);

    if (!data) {
      return CommandResultFactory({
        error: new InvalidStatusWordError("Invalid payload"),
      });
    }

    return new SendCommandInChunksTask(this.api, {
      data,
      commandFactory,
    }).run();
  }
}
