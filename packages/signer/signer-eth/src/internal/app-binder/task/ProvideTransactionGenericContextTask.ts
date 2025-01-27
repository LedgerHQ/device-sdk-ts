import {
  type ClearSignContextSuccess,
  type ClearSignContextSuccessType,
  type ClearSignContextType,
  type ContextModule,
} from "@ledgerhq/context-module";
import {
  ByteArrayBuilder,
  type CommandErrorResult,
  type InternalApi,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { DerivationPathUtils } from "@ledgerhq/signer-utils";
import { Just, type Maybe, Nothing } from "purify-ts";

import { ProvideTransactionInformationCommand } from "@internal/app-binder/command/ProvideTransactionInformationCommand";
import { StoreTransactionCommand } from "@internal/app-binder/command/StoreTransactionCommand";
import { type EthErrorCodes } from "@internal/app-binder/command/utils/ethAppErrors";
import { type TransactionParserService } from "@internal/transaction/service/parser/TransactionParserService";

import { ProvideTransactionFieldDescriptionTask } from "./ProvideTransactionFieldDescriptionTask";
import { SendCommandInChunksTask } from "./SendCommandInChunksTask";
import { SendPayloadInChunksTask } from "./SendPayloadInChunksTask";

export type GenericContext = {
  readonly transactionInfo: string;
  readonly transactionFields: ClearSignContextSuccess<
    Exclude<ClearSignContextSuccessType, ClearSignContextType.ENUM>
  >[];
  readonly transactionEnums: ClearSignContextSuccess<ClearSignContextType.ENUM>[];
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
  void | EthErrorCodes;

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
      const result = await new ProvideTransactionFieldDescriptionTask(
        this.api,
        {
          field,
          serializedTransaction: this.args.serializedTransaction,
          chainId: this.args.chainId,
          transactionParser: this.args.transactionParser,
          contextModule: this.args.contextModule,
          transactionEnums: this.args.context.transactionEnums,
        },
      ).run();

      if (result.isJust()) {
        return result;
      }
    }

    return Nothing;
  }
}
