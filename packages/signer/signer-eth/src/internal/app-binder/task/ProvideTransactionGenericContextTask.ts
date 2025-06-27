import {
  type ClearSignContextSuccess,
  type ClearSignContextSuccessType,
  type ClearSignContextType,
  type ContextModule,
  type PkiCertificate,
} from "@ledgerhq/context-module";
import {
  ByteArrayBuilder,
  type CommandErrorResult,
  type InternalApi,
  isSuccessCommandResult,
  LoadCertificateCommand,
} from "@ledgerhq/device-management-kit";
import { DerivationPathUtils } from "@ledgerhq/signer-utils";
import { Just, type Maybe, Nothing } from "purify-ts";

import { ProvideTransactionInformationCommand } from "@internal/app-binder/command/ProvideTransactionInformationCommand";
import { StoreTransactionCommand } from "@internal/app-binder/command/StoreTransactionCommand";
import { type EthErrorCodes } from "@internal/app-binder/command/utils/ethAppErrors";
import { type TransactionParserService } from "@internal/transaction/service/parser/TransactionParserService";

import {
  ProvideTransactionFieldDescriptionTask,
  type ProvideTransactionFieldDescriptionTaskArgs,
} from "./ProvideTransactionFieldDescriptionTask";
import { SendCommandInChunksTask } from "./SendCommandInChunksTask";
import { SendPayloadInChunksTask } from "./SendPayloadInChunksTask";

export type GenericContext = {
  readonly transactionInfo: string;
  readonly transactionInfoCertificate: PkiCertificate;
  readonly transactionFields: ClearSignContextSuccess<
    Exclude<ClearSignContextSuccessType, ClearSignContextType.ENUM>
  >[];
  readonly transactionEnums: ClearSignContextSuccess<ClearSignContextType.ENUM>[];
  readonly web3Check: ClearSignContextSuccess<ClearSignContextType.WEB3_CHECK> | null;
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
    private _api: InternalApi,
    private _args: ProvideTransactionGenericContextTaskArgs,
    private _provideTransactionFieldDescriptionTaskFactory = (
      api: InternalApi,
      args: ProvideTransactionFieldDescriptionTaskArgs,
    ) => new ProvideTransactionFieldDescriptionTask(api, args),
  ) {}

  async run(): Promise<
    Maybe<CommandErrorResult<ProvideTransactionGenericContextTaskErrorCodes>>
  > {
    // Store the transaction in the device memory
    const paths = DerivationPathUtils.splitPath(this._args.derivationPath);
    const builder = new ByteArrayBuilder();
    builder.add8BitUIntToData(paths.length);
    paths.forEach((path) => {
      builder.add32BitUIntToData(path);
    });
    builder.addBufferToData(this._args.serializedTransaction);
    const storeTransactionResult = await new SendCommandInChunksTask(
      this._api,
      {
        data: builder.build(),
        commandFactory: (args) =>
          new StoreTransactionCommand({
            serializedTransaction: args.chunkedData,
            isFirstChunk: args.isFirstChunk,
          }),
      },
    ).run();

    if (!isSuccessCommandResult(storeTransactionResult)) {
      return Just(storeTransactionResult);
    }

    if (this._args.context.transactionInfoCertificate) {
      const { keyUsageNumber: keyUsage, payload: certificate } =
        this._args.context.transactionInfoCertificate;
      await this._api.sendCommand(
        new LoadCertificateCommand({
          keyUsage,
          certificate,
        }),
      );
    }

    // Provide the transaction information
    const transactionInfoResult = await new SendPayloadInChunksTask(this._api, {
      payload: this._args.context.transactionInfo,
      commandFactory: (args) =>
        new ProvideTransactionInformationCommand({
          data: args.chunkedData,
          isFirstChunk: args.isFirstChunk,
        }),
    }).run();

    if (!isSuccessCommandResult(transactionInfoResult)) {
      return Just(transactionInfoResult);
    }

    // If there is a web3 check, add it to the transactionField array
    const fields = this._args.context.web3Check
      ? [...this._args.context.transactionFields, this._args.context.web3Check]
      : this._args.context.transactionFields;

    // Provide the transaction field description and according metadata reference
    for (const field of fields) {
      const result = await this._provideTransactionFieldDescriptionTaskFactory(
        this._api,
        {
          field,
          serializedTransaction: this._args.serializedTransaction,
          chainId: this._args.chainId,
          transactionParser: this._args.transactionParser,
          contextModule: this._args.contextModule,
          transactionEnums: this._args.context.transactionEnums,
        },
      ).run();

      if (result.isJust()) {
        return result;
      }
    }

    return Nothing;
  }
}
