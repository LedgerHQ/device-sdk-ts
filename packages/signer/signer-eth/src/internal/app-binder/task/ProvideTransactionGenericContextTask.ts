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

import { ProvideTransactionFieldDescriptionTask } from "./ProvideTransactionFieldDescriptionTask";
import { SendCommandInChunksTask } from "./SendCommandInChunksTask";
import { SendPayloadInChunksTask } from "./SendPayloadInChunksTask";

export type GenericContext = {
  readonly transactionInfo: string;
  readonly transactionInfoCertificate: PkiCertificate;
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
  readonly web3Check: ClearSignContextSuccess<ClearSignContextType.WEB3_CHECK> | null;
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
      commandFactory: (args) => new StoreTransactionCommand(args),
    }).run();

    if (!isSuccessCommandResult(storeTransactionResult)) {
      return Just(storeTransactionResult);
    }

    if (this.args.context.transactionInfoCertificate) {
      const { keyUsageNumber: keyUsage, payload: certificate } =
        this.args.context.transactionInfoCertificate;
      await this.api.sendCommand(
        new LoadCertificateCommand({
          keyUsage,
          certificate,
        }),
      );
    }

    // Provide the transaction information
    const transactionInfoResult = await new SendPayloadInChunksTask(this.api, {
      payload: this.args.context.transactionInfo,
      commandFactory: (args) => new ProvideTransactionInformationCommand(args),
    }).run();

    if (!isSuccessCommandResult(transactionInfoResult)) {
      return Just(transactionInfoResult);
    }

    // If there is a web3 check, add it to the transactionField array
    const fields = this.args.web3Check
      ? [...this.args.context.transactionFields, this.args.web3Check]
      : this.args.context.transactionFields;

    // Provide the transaction field description and according metadata reference
    for (const field of fields) {
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
