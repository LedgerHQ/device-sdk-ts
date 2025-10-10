import {
  type ClearSignContextSuccess,
  ClearSignContextType,
} from "@ledgerhq/context-module";
import {
  ByteArrayBuilder,
  type CommandErrorResult,
  type CommandResult,
  CommandResultFactory,
  type InternalApi,
  InvalidStatusWordError,
  isSuccessCommandResult,
  LoadCertificateCommand,
} from "@ledgerhq/device-management-kit";
import { DerivationPathUtils } from "@ledgerhq/signer-utils";
import { type Either, Left, Right } from "purify-ts";

import { ProvideEnumCommand } from "@internal/app-binder/command/ProvideEnumCommand";
import {
  NetworkConfigurationType,
  ProvideNetworkConfigurationCommand,
} from "@internal/app-binder/command/ProvideNetworkConfigurationCommand";
import { ProvideNFTInformationCommand } from "@internal/app-binder/command/ProvideNFTInformationCommand";
import { ProvideProxyInfoCommand } from "@internal/app-binder/command/ProvideProxyInfoCommand";
import { ProvideTokenInformationCommand } from "@internal/app-binder/command/ProvideTokenInformationCommand";
import { ProvideTransactionFieldDescriptionCommand } from "@internal/app-binder/command/ProvideTransactionFieldDescriptionCommand";
import { ProvideTransactionInformationCommand } from "@internal/app-binder/command/ProvideTransactionInformationCommand";
import { ProvideTrustedNameCommand } from "@internal/app-binder/command/ProvideTrustedNameCommand";
import { ProvideWeb3CheckCommand } from "@internal/app-binder/command/ProvideWeb3CheckCommand";
import { SetExternalPluginCommand } from "@internal/app-binder/command/SetExternalPluginCommand";
import { SetPluginCommand } from "@internal/app-binder/command/SetPluginCommand";
import { StoreTransactionCommand } from "@internal/app-binder/command/StoreTransactionCommand";
import { type EthErrorCodes } from "@internal/app-binder/command/utils/ethAppErrors";

import { type ContextWithSubContexts } from "./BuildFullContextsTask";
import {
  SendCommandInChunksTask,
  type SendCommandInChunksTaskArgs,
} from "./SendCommandInChunksTask";
import {
  SendPayloadInChunksTask,
  type SendPayloadInChunksTaskArgs,
} from "./SendPayloadInChunksTask";

export type ProvideContextsTaskArgs = {
  /**
   * The list of clear sign context with subcontexts callback to provide.
   */
  contexts: ContextWithSubContexts[];
  /**
   * The derivation path to provide.
   */
  derivationPath: string;
  /**
   * The serialized transaction to provide.
   * This parameter is optional in the case there is no transaction at all, for instance
   * if there is only a standalone calldata embedded in a message.
   */
  serializedTransaction?: Uint8Array;
};

export type ProvideContextsTaskResult = Either<
  CommandErrorResult<EthErrorCodes>,
  void
>;

/**
 * This task is responsible for providing the transaction context to the device.
 * It will send the subcontexts callbacks in order and finish with the context.
 */
export class ProvideContextsTask {
  constructor(
    private _api: InternalApi,
    private _args: ProvideContextsTaskArgs,
    private _sendPayloadInChunksTaskFactory = (
      api: InternalApi,
      args: SendPayloadInChunksTaskArgs<unknown>,
    ) => new SendPayloadInChunksTask(api, args),
    private _sendCommandInChunksTaskFactory = (
      api: InternalApi,
      args: SendCommandInChunksTaskArgs<unknown>,
    ) => new SendCommandInChunksTask(api, args),
  ) {}

  async run(): Promise<ProvideContextsTaskResult> {
    let transactionInfoProvided = false;

    for (const { context, subcontextCallbacks } of this._args.contexts) {
      for (const callback of subcontextCallbacks) {
        const subcontext = await callback();

        if (subcontext.type === ClearSignContextType.ERROR) {
          // silently ignore error subcontexts
          continue;
        }

        // Don't fail immediately on subcontext errors because the main context may still be successful
        await this.provideContext(subcontext);
      }

      if (context.type === ClearSignContextType.PROXY_INFO) {
        // In this specific case, the context is not valid as the challenge is not valid on the first call
        // the real data is provided in the subcontext callback
        continue;
      }

      if (
        !transactionInfoProvided &&
        this._args.serializedTransaction !== undefined &&
        context.type === ClearSignContextType.TRANSACTION_INFO
      ) {
        // Send the serialized transaction for the first TRANSACTION_INFO.
        // All other TRANSACTION_INFO contexts will be ignored as it will be for nested calldata.
        transactionInfoProvided = true;

        const paths = DerivationPathUtils.splitPath(this._args.derivationPath);
        const builder = new ByteArrayBuilder();
        builder.add8BitUIntToData(paths.length);
        paths.forEach((path) => {
          builder.add32BitUIntToData(path);
        });
        builder.addBufferToData(this._args.serializedTransaction);
        await this._sendCommandInChunksTaskFactory(this._api, {
          data: builder.build(),
          commandFactory: (args) =>
            new StoreTransactionCommand({
              serializedTransaction: args.chunkedData,
              isFirstChunk: args.isFirstChunk,
            }),
        }).run();
      }

      const res = await this.provideContext(context);
      if (!isSuccessCommandResult(res)) {
        return Left(res);
      }
    }

    return Right(void 0);
  }

  /**
   * This method will send the context to the device.
   *
   * @param context The clear sign context to provide.
   * @returns A promise that resolves when the command is sent.
   */
  async provideContext({
    type,
    payload,
    certificate,
  }: ClearSignContextSuccess): Promise<CommandResult<unknown, EthErrorCodes>> {
    // if a certificate is provided, we load it before sending the command
    if (certificate) {
      await this._api.sendCommand(
        new LoadCertificateCommand({
          keyUsage: certificate.keyUsageNumber,
          certificate: certificate.payload,
        }),
      );
    }

    switch (type) {
      case ClearSignContextType.PLUGIN: {
        return await this._api.sendCommand(new SetPluginCommand({ payload }));
      }
      case ClearSignContextType.EXTERNAL_PLUGIN: {
        return await this._api.sendCommand(
          new SetExternalPluginCommand({ payload }),
        );
      }
      case ClearSignContextType.NFT: {
        return await this._api.sendCommand(
          new ProvideNFTInformationCommand({ payload }),
        );
      }
      case ClearSignContextType.TOKEN: {
        return await this._api.sendCommand(
          new ProvideTokenInformationCommand({ payload }),
        );
      }
      case ClearSignContextType.TRANSACTION_INFO: {
        const transactionInfoResult =
          await this._sendPayloadInChunksTaskFactory(this._api, {
            payload,
            commandFactory: (args) =>
              new ProvideTransactionInformationCommand({
                data: args.chunkedData,
                isFirstChunk: args.isFirstChunk,
              }),
          }).run();

        return transactionInfoResult;
      }
      case ClearSignContextType.TRUSTED_NAME: {
        return this._sendPayloadInChunksTaskFactory(this._api, {
          payload,
          commandFactory: (args) =>
            new ProvideTrustedNameCommand({
              data: args.chunkedData,
              isFirstChunk: args.isFirstChunk,
            }),
        }).run();
      }
      case ClearSignContextType.ENUM:
        return this._sendPayloadInChunksTaskFactory(this._api, {
          payload,
          commandFactory: (args) =>
            new ProvideEnumCommand({
              data: args.chunkedData,
              isFirstChunk: args.isFirstChunk,
            }),
        }).run();
      case ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION:
        return this._sendPayloadInChunksTaskFactory(this._api, {
          payload,
          commandFactory: (args) =>
            new ProvideTransactionFieldDescriptionCommand({
              data: args.chunkedData,
              isFirstChunk: args.isFirstChunk,
            }),
        }).run();
      case ClearSignContextType.WEB3_CHECK:
        return this._sendPayloadInChunksTaskFactory(this._api, {
          payload,
          commandFactory: (args) =>
            new ProvideWeb3CheckCommand({
              payload: args.chunkedData,
              isFirstChunk: args.isFirstChunk,
            }),
        }).run();
      case ClearSignContextType.PROXY_INFO:
        return this._sendPayloadInChunksTaskFactory(this._api, {
          payload,
          commandFactory: (args) =>
            new ProvideProxyInfoCommand({
              data: args.chunkedData,
              isFirstChunk: args.isFirstChunk,
            }),
        }).run();
      case ClearSignContextType.DYNAMIC_NETWORK:
        // Dynamic network configuration uses the existing ProvideNetworkConfiguration command
        // but is provided as part of the context flow
        return this._sendPayloadInChunksTaskFactory(this._api, {
          payload,
          commandFactory: (args) =>
            new ProvideNetworkConfigurationCommand({
              data: args.chunkedData,
              isFirstChunk: args.isFirstChunk,
              configurationType: NetworkConfigurationType.CONFIGURATION,
            }),
        }).run();
      case ClearSignContextType.DYNAMIC_NETWORK_ICON: {
        return this._sendPayloadInChunksTaskFactory(this._api, {
          payload,
          commandFactory: (args) =>
            new ProvideNetworkConfigurationCommand({
              data: args.chunkedData,
              isFirstChunk: args.isFirstChunk,
              configurationType: NetworkConfigurationType.ICON,
            }),
          withPayloadLength: false,
        }).run();
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
}
