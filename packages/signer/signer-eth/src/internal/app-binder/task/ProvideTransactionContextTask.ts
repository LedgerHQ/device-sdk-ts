import {
  type ClearSignContext,
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
import { ProvideNFTInformationCommand } from "@internal/app-binder/command/ProvideNFTInformationCommand";
import { ProvideTokenInformationCommand } from "@internal/app-binder/command/ProvideTokenInformationCommand";
import { ProvideTransactionFieldDescriptionCommand } from "@internal/app-binder/command/ProvideTransactionFieldDescriptionCommand";
import { ProvideTransactionInformationCommand } from "@internal/app-binder/command/ProvideTransactionInformationCommand";
import { ProvideTrustedNameCommand } from "@internal/app-binder/command/ProvideTrustedNameCommand";
import { ProvideWeb3CheckCommand } from "@internal/app-binder/command/ProvideWeb3CheckCommand";
import { SetExternalPluginCommand } from "@internal/app-binder/command/SetExternalPluginCommand";
import { SetPluginCommand } from "@internal/app-binder/command/SetPluginCommand";
import { StoreTransactionCommand } from "@internal/app-binder/command/StoreTransactionCommand";
import { type EthErrorCodes } from "@internal/app-binder/command/utils/ethAppErrors";

import {
  SendCommandInChunksTask,
  type SendCommandInChunksTaskArgs,
} from "./SendCommandInChunksTask";
import {
  SendPayloadInChunksTask,
  type SendPayloadInChunksTaskArgs,
} from "./SendPayloadInChunksTask";

export type ProvideTransactionContextTaskArgs = {
  /**
   * The clear sign context to provide.
   */
  context: ClearSignContextSuccess;
  /**
   * The subcontexts callbacks to provide.
   */
  subcontextsCallbacks: (() => Promise<ClearSignContext>)[];
  /**
   * The serialized transaction to provide.
   */
  serializedTransaction: Uint8Array;
  /**
   * The derivation path to provide.
   */
  derivationPath: string;
};

/**
 * This task is responsible for providing the transaction context to the device.
 * It will send the subcontexts callbacks in order and finish with the context.
 */
export class ProvideTransactionContextTask {
  constructor(
    private _api: InternalApi,
    private _args: ProvideTransactionContextTaskArgs,
    private _sendPayloadInChunksTaskFactory = (
      api: InternalApi,
      args: SendPayloadInChunksTaskArgs<unknown>,
    ) => new SendPayloadInChunksTask(api, args),
    private _sendCommandInChunksTaskFactory = (
      api: InternalApi,
      args: SendCommandInChunksTaskArgs<unknown>,
    ) => new SendCommandInChunksTask(api, args),
  ) {}

  async run(): Promise<Either<CommandErrorResult<EthErrorCodes>, void>> {
    for (const callback of this._args.subcontextsCallbacks) {
      const subcontext = await callback();

      if (subcontext.type === ClearSignContextType.ERROR) {
        // silently ignore error subcontexts
        continue;
      }

      const res = await this.provideContext(subcontext);
      if (!isSuccessCommandResult(res)) {
        return Left(res);
      }
    }

    const res = await this.provideContext(this._args.context);
    if (!isSuccessCommandResult(res)) {
      return Left(res);
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
    if (certificate && type !== ClearSignContextType.TRANSACTION_INFO) {
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

        // TODO: What happens if the certificate is not provided?
        if (certificate) {
          await this._api.sendCommand(
            new LoadCertificateCommand({
              keyUsage: certificate.keyUsageNumber,
              certificate: certificate.payload,
            }),
          );
        }

        const transactionInfoResult =
          await this._sendPayloadInChunksTaskFactory(this._api, {
            payload: this._args.context.payload,
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
