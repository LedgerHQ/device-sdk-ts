import {
  type ClearSignContextReference,
  type ClearSignContextSuccess,
  ClearSignContextType,
  type ContextModule,
} from "@ledgerhq/context-module";
import {
  bufferToHexaString,
  ByteArrayBuilder,
  type CommandErrorResult,
  type CommandResult,
  CommandResultFactory,
  type InternalApi,
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { DerivationPathUtils } from "@ledgerhq/signer-utils";
import { Just, type Maybe, Nothing } from "purify-ts";

import { GetChallengeCommand } from "@internal/app-binder/command/GetChallengeCommand";
import { ProvideEnumCommand } from "@internal/app-binder/command/ProvideEnumCommand";
import {
  ProvideNFTInformationCommand,
  type ProvideNFTInformationCommandErrorCodes,
} from "@internal/app-binder/command/ProvideNFTInformationCommand";
import {
  ProvideTokenInformationCommand,
  type ProvideTokenInformationCommandResponse,
} from "@internal/app-binder/command/ProvideTokenInformationCommand";
import { ProvideTransactionFieldDescriptionCommand } from "@internal/app-binder/command/ProvideTransactionFieldDescriptionCommand";
import { ProvideTransactionInformationCommand } from "@internal/app-binder/command/ProvideTransactionInformationCommand";
import { ProvideTrustedNameCommand } from "@internal/app-binder/command/ProvideTrustedNameCommand";
import { StoreTransactionCommand } from "@internal/app-binder/command/StoreTransactionCommand";
import { PayloadUtils } from "@internal/shared/utils/PayloadUtils";
import { type TransactionParserService } from "@internal/transaction/service/parser/TransactionParserService";

import {
  SendCommandInChunksTask,
  type SendCommandInChunksTaskArgs,
} from "./SendCommandInChunksTask";
import { SendPayloadInChunksTask } from "./SendPayloadInChunksTask";

export type GenericContext = {
  readonly transactionInfo: string;
  readonly transactionFields: ClearSignContextSuccess[];
};

export type ProvideTransactionGenericContextTaskArgs = {
  readonly contextModule: ContextModule;
  readonly transactionParser: TransactionParserService;
  readonly chainId: number;
  readonly derivationPath: string;
  readonly serializedTransaction: Uint8Array;
  readonly context: GenericContext;
};

export type ProvideTransactionGenericContextTaskErrorCodes =
  void | ProvideNFTInformationCommandErrorCodes;

export class ProvideTransactionGenericContextTask {
  constructor(
    private api: InternalApi,
    private args: ProvideTransactionGenericContextTaskArgs,
  ) {}

  async run(): Promise<
    Maybe<CommandErrorResult<ProvideTransactionGenericContextTaskErrorCodes>>
  > {
    // Store the transaction in the device memory
    const paths = DerivationPathUtils.splitPath(this.args.derivationPath);
    const builder = new ByteArrayBuilder();
    builder.add8BitUIntToData(paths.length);
    paths.forEach((path) => {
      builder.add32BitUIntToData(path);
    });
    builder.addBufferToData(this.args.serializedTransaction);
    const storeTransactionResult = await new SendCommandInChunksTask(this.api, {
      data: builder.build(),
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
    const transactionInfoResult = await new SendPayloadInChunksTask(this.api, {
      payload: this.args.context.transactionInfo,
      commandFactory: (args) =>
        new ProvideTransactionInformationCommand({
          data: args.chunkedData,
          isFirstChunk: args.isFirstChunk,
        }),
    }).run();

    if (!isSuccessCommandResult(transactionInfoResult)) {
      return Just(transactionInfoResult);
    }

    // Provide the transaction field description and according metadata reference
    for (const field of this.args.context.transactionFields) {
      if (field.reference !== undefined) {
        const provideReferenceResult = await this.provideContextReference(
          field.reference,
        );
        if (provideReferenceResult.isJust()) {
          return provideReferenceResult;
        }
      }

      const transactionFieldResult = await this.provideContext({ ...field });
      if (!isSuccessCommandResult(transactionFieldResult)) {
        return Just(transactionFieldResult);
      }
    }

    return Nothing;
  }

  async provideContextReference(
    reference: ClearSignContextReference,
  ): Promise<
    Maybe<CommandErrorResult<ProvideTransactionGenericContextTaskErrorCodes>>
  > {
    const values = this.args.transactionParser.extractValue(
      this.args.serializedTransaction,
      reference.valuePath,
    );
    if (values.isLeft()) {
      // The path was not found in transaction payload. In that case we should raw-sign that field.
      return Nothing;
    }
    for (const value of values.unsafeCoerce()) {
      const address = bufferToHexaString(
        value.slice(Math.max(0, value.length - 20)),
      );
      let context;
      if (reference.type === ClearSignContextType.TRUSTED_NAME) {
        const getChallengeResult = await this.api.sendCommand(
          new GetChallengeCommand(),
        );
        if (!isSuccessCommandResult(getChallengeResult)) {
          return Just(getChallengeResult);
        }
        context = await this.args.contextModule.getContext({
          type: reference.type,
          chainId: this.args.chainId,
          address,
          challenge: getChallengeResult.data.challenge,
          types: reference.types,
          sources: reference.sources,
        });
      } else {
        context = await this.args.contextModule.getContext({
          type: reference.type,
          chainId: this.args.chainId,
          address,
        });
      }
      if (context.type !== ClearSignContextType.ERROR) {
        const provideReferenceResult = await this.provideContext(context);
        if (!isSuccessCommandResult(provideReferenceResult)) {
          return Just(provideReferenceResult);
        }
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
      case ClearSignContextType.NFT:
        return await this.api.sendCommand(
          new ProvideNFTInformationCommand({ payload }),
        );
      case ClearSignContextType.TOKEN:
        return await this.api.sendCommand(
          new ProvideTokenInformationCommand({ payload }),
        );
      case ClearSignContextType.TRUSTED_NAME:
        return this.sendInChunks(
          payload,
          (args) =>
            new ProvideTrustedNameCommand({
              data: args.chunkedData,
              isFirstChunk: args.isFirstChunk,
            }),
        );
      case ClearSignContextType.ENUM:
        return this.sendInChunks(
          payload,
          (args) =>
            new ProvideEnumCommand({
              data: args.chunkedData,
              isFirstChunk: args.isFirstChunk,
            }),
        );
      case ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION:
        return this.sendInChunks(
          payload,
          (args) =>
            new ProvideTransactionFieldDescriptionCommand({
              data: args.chunkedData,
              isFirstChunk: args.isFirstChunk,
            }),
        );
      case ClearSignContextType.TRANSACTION_INFO:
      case ClearSignContextType.PLUGIN:
      case ClearSignContextType.EXTERNAL_PLUGIN:
        return CommandResultFactory({
          error: new InvalidStatusWordError(
            `The context type [${type}] is not valid as a transaction field or metadata`,
          ),
        });
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
