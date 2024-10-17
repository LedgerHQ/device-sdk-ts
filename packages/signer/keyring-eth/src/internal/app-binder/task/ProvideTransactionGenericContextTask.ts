import {
  type ClearSignContextSuccess,
  ClearSignContextType,
} from "@ledgerhq/context-module";
import {
  type CommandErrorResult,
  CommandResult,
  type InternalApi,
  isSuccessCommandResult,
  type SdkError,
} from "@ledgerhq/device-management-kit";
import { Just, Maybe, Nothing } from "purify-ts";

import { ProvideDomainNameCommand } from "@internal/app-binder/command/ProvideDomainNameCommand";
import { ProvideEnumCommand } from "@internal/app-binder/command/ProvideEnumCommand";
import {
  ProvideNFTInformationCommand,
  type ProvideNFTInformationCommandErrorCodes,
} from "@internal/app-binder/command/ProvideNFTInformationCommand";
import {
  ProvideTokenInformationCommand,
  ProvideTokenInformationCommandResponse,
} from "@internal/app-binder/command/ProvideTokenInformationCommand";
import { ProvideTransactionFieldDescriptionCommand } from "@internal/app-binder/command/ProvideTransactionFieldDescriptionCommand";
import { ProvideTransactionInformationCommand } from "@internal/app-binder/command/ProvideTransactionInformationCommand";
import {
  SetPluginCommand,
  type SetPluginCommandErrorCodes,
} from "@internal/app-binder/command/SetPluginCommand";
import { StoreTransactionCommand } from "@internal/app-binder/command/StoreTransactionCommand";
import { PayloadUtils } from "@internal/shared/utils/PayloadUtils";

import { SendCommandInChunksTask } from "./SendCommandInChunksTask";

export type ProvideTransactionGenericContextTaskArgs = {
  serializedTransaction: Uint8Array;
  transactionInfo: Uint8Array;
  transactionFieldDescription: Record<string, string>;
  metadatas: Record<string, ClearSignContextSuccess>;
};

/**
 * Temporary error type to be used in the `ProvideTransactionGenericContextTask` in order to not forget to handle the error cases.
 */
export class ProvideTransactionGenericContextTaskError implements SdkError {
  readonly _tag = "ProvideTransactionGenericContextTaskError";
  readonly originalError: Error;

  constructor(message?: string) {
    this.originalError = new Error(
      message ?? "Unknow error in ProvideTransactionGenericContextTaskError",
    );
  }
}

export type ProvideTransactionGenericContextTaskErrorCodes =
  | void
  | SetPluginCommandErrorCodes
  | ProvideNFTInformationCommandErrorCodes;

export class ProvideTransactionGenericContextTask {
  constructor(
    private api: InternalApi,
    private args: ProvideTransactionGenericContextTaskArgs,
  ) {}

  async run(): Promise<
    Maybe<CommandErrorResult<ProvideTransactionGenericContextTaskErrorCodes>>
  > {
    // Store the transaction in the device memory
    const storeTransactionResult = await new SendCommandInChunksTask(this.api, {
      data: this.args.serializedTransaction,
      commandFactory: (args) =>
        new StoreTransactionCommand({
          serializedTransaction: args.chunkedData,
          isFirstChunk: args.isFirstChunk,
        }),
    }).run();

    if (!isSuccessCommandResult(storeTransactionResult)) {
      return Just(storeTransactionResult);
    }

    // Provide the transaction information
    const transactionInfoResult = await new SendCommandInChunksTask(this.api, {
      data: this.args.transactionInfo,
      commandFactory: (args) =>
        new ProvideTransactionInformationCommand({
          data: args.chunkedData,
          isFirstChunk: args.isFirstChunk,
        }),
    }).run();

    if (!isSuccessCommandResult(transactionInfoResult)) {
      return Just(transactionInfoResult);
    }

    // Provide the transaction field description and metadata
    // The metadata should be provided first if it exists
    for (const key of Object.keys(this.args.transactionFieldDescription)) {
      if (this.args.metadatas[key]) {
        const metadata = this.args.metadatas[key];
        const metadataResult = await this.provideContext(metadata);

        if (!isSuccessCommandResult(metadataResult)) {
          return Just(metadataResult);
        }
      }

      const transactionFieldResult = await this.provideContext({
        type: ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION,
        // key is a keyof typeof this.args.transactionFieldDescription
        // so it is safe to use it as a key to access the value of the object
        payload: this.args.transactionFieldDescription[key]!,
      });

      if (!isSuccessCommandResult(transactionFieldResult)) {
        return Just(transactionFieldResult);
      }
    }

    return Nothing;
  }

  /**
   * This method will send a command according to the clear sign context type
   * and return the command result if only one command is sent,
   * otherwise it will return the result of the command.
   *
   * @param {ClearSignContextSuccess} context The clear sign context to provide.
   * @returns A promise that resolves when the command return a command response.
   */
  async provideContext({
    type,
    payload,
  }: ClearSignContextSuccess): Promise<
    CommandResult<
      void | ProvideTokenInformationCommandResponse,
      ProvideTransactionGenericContextTaskErrorCodes
    >
  > {
    switch (type) {
      case ClearSignContextType.PLUGIN: {
        return await this.api.sendCommand(new SetPluginCommand({ payload }));
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
      case ClearSignContextType.DOMAIN_NAME: {
        return new SendCommandInChunksTask(this.api, {
          data: PayloadUtils.getBufferFromPayload(payload),
          commandFactory: (args) =>
            new ProvideDomainNameCommand({
              data: args.chunkedData,
              isFirstChunk: args.isFirstChunk,
            }),
        }).run();
      }
      case ClearSignContextType.ENUM: {
        return new SendCommandInChunksTask(this.api, {
          data: PayloadUtils.getBufferFromPayload(payload),
          commandFactory: (args) =>
            new ProvideEnumCommand({
              data: args.chunkedData,
              isFirstChunk: args.isFirstChunk,
            }),
        }).run();
      }
      case ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION: {
        return new SendCommandInChunksTask(this.api, {
          data: PayloadUtils.getBufferFromPayload(payload),
          commandFactory: (args) =>
            new ProvideTransactionFieldDescriptionCommand({
              data: args.chunkedData,
              isFirstChunk: args.isFirstChunk,
            }),
        }).run();
      }
      case ClearSignContextType.TRANSACTION_INFO: {
        return new SendCommandInChunksTask(this.api, {
          data: PayloadUtils.getBufferFromPayload(payload),
          commandFactory: (args) =>
            new ProvideTransactionInformationCommand({
              data: args.chunkedData,
              isFirstChunk: args.isFirstChunk,
            }),
        }).run();
      }
      case ClearSignContextType.EXTERNAL_PLUGIN: {
        throw new ProvideTransactionGenericContextTaskError(
          "The context type [EXTERNAL_PLUGIN] is not valid here",
        );
      }
      default: {
        const uncoveredType: never = type;
        throw new ProvideTransactionGenericContextTaskError(
          `The context type [${uncoveredType}] is not covered`,
        );
      }
    }
  }
}
