import {
  type ClearSignContextReference,
  type ClearSignContextSuccess,
  type ClearSignContextSuccessType,
  ClearSignContextType,
  type ContextModule,
  type PkiCertificate,
  type TransactionFieldContext,
} from "@ledgerhq/context-module";
import {
  bufferToHexaString,
  type CommandErrorResult,
  type CommandResult,
  CommandResultFactory,
  type HexaString,
  type InternalApi,
  InvalidStatusWordError,
  isSuccessCommandResult,
  LoadCertificateCommand,
} from "@ledgerhq/device-management-kit";
import { Just, type Maybe, Nothing } from "purify-ts";

import { GetChallengeCommand } from "@internal/app-binder/command/GetChallengeCommand";
import { ProvideEnumCommand } from "@internal/app-binder/command/ProvideEnumCommand";
import { ProvideNFTInformationCommand } from "@internal/app-binder/command/ProvideNFTInformationCommand";
import {
  ProvideTokenInformationCommand,
  type ProvideTokenInformationCommandResponse,
} from "@internal/app-binder/command/ProvideTokenInformationCommand";
import { ProvideTransactionFieldDescriptionCommand } from "@internal/app-binder/command/ProvideTransactionFieldDescriptionCommand";
import { ProvideTrustedNameCommand } from "@internal/app-binder/command/ProvideTrustedNameCommand";
import { ProvideWeb3CheckCommand } from "@internal/app-binder/command/ProvideWeb3CheckCommand";
import { type EthErrorCodes } from "@internal/app-binder/command/utils/ethAppErrors";
import { type TransactionParserService } from "@internal/transaction/service/parser/TransactionParserService";

import { type ProvideTransactionGenericContextTaskErrorCodes } from "./ProvideTransactionGenericContextTask";
import { SendPayloadInChunksTask } from "./SendPayloadInChunksTask";

export type ProvideTransactionFieldDescriptionTaskArgs = {
  field: ClearSignContextSuccess<
    Exclude<ClearSignContextSuccessType, ClearSignContextType.ENUM>
  >;
  serializedTransaction: Uint8Array;
  chainId: number;
  transactionParser: TransactionParserService;
  contextModule: ContextModule;
  transactionEnums: ClearSignContextSuccess<ClearSignContextType.ENUM>[];
};

export type ProvideTransactionFieldDescriptionTaskErrorCodes =
  void | EthErrorCodes;

/**
 * This task is responsible for providing the transaction context to the device.
 *
 */
export class ProvideTransactionFieldDescriptionTask {
  constructor(
    private api: InternalApi,
    private args: ProvideTransactionFieldDescriptionTaskArgs,
  ) {}

  async run(): Promise<
    Maybe<
      CommandErrorResult<
        ProvideTransactionFieldDescriptionTaskErrorCodes | EthErrorCodes
      >
    >
  > {
    const { field } = this.args;

    // If a certificate is provided, start by loading it to the device
    await this.loadCertificate(field.certificate);

    // if the reference is a string, it means it is a direct address
    // and we don't need to extract the value from the transaction
    // as it is already provided in the reference
    if (
      field.reference !== undefined &&
      "value" in field.reference &&
      field.reference.value !== undefined
    ) {
      await this.getAndProvideContext({
        type: field.reference.type,
        chainId: this.args.chainId,
        address: field.reference.value,
      });
    }

    // if the reference is a path, it means we need to extract the value
    // from the transaction and provide it to the device
    if (
      field.reference !== undefined &&
      field.reference.valuePath !== undefined
    ) {
      // iterate on each reference and provide the context
      const referenceValues = this.args.transactionParser.extractValue(
        this.args.serializedTransaction,
        field.reference.valuePath,
      );

      if (referenceValues.isRight()) {
        for (const value of referenceValues.extract()) {
          const provideReferenceResult = await this.provideContextReference(
            field.reference,
            value,
          );
          if (provideReferenceResult.isJust()) {
            return provideReferenceResult;
          }
        }
      }
    }

    const transactionFieldResult = await this.provideContext({ ...field });
    if (!isSuccessCommandResult(transactionFieldResult)) {
      return Just(transactionFieldResult);
    }

    return Nothing;
  }

  /**
   * This method will load the certificate to the device if it is provided.
   *
   * @param {PkiCertificate | undefined} certificate The certificate to load to the device.
   * @returns A promise that resolves when the certificate is loaded.
   */
  private async loadCertificate(
    certificate: PkiCertificate | undefined,
  ): Promise<void> {
    if (!certificate) return;

    await this.api.sendCommand(
      new LoadCertificateCommand({
        keyUsage: certificate.keyUsageNumber,
        certificate: certificate.payload,
      }),
    );
  }

  /**
   * This method will provide the context reference to the device.
   *
   * @param {ClearSignContextReference} reference The reference to provide.
   * @param {Uint8Array} value The value of the reference.
   * @returns A promise that resolves when the context is provided.
   */
  private async provideContextReference(
    reference: ClearSignContextReference,
    value: Uint8Array,
  ): Promise<
    Maybe<
      CommandErrorResult<
        ProvideTransactionGenericContextTaskErrorCodes | EthErrorCodes
      >
    >
  > {
    if (reference.type === ClearSignContextType.ENUM) {
      return this.provideEnumContextReference(reference, value);
    }

    const address = bufferToHexaString(
      value.slice(Math.max(0, value.length - 20)),
    );

    if (reference.type === ClearSignContextType.TRUSTED_NAME) {
      return this.provideTustedNameContextReference(reference, address);
    }

    return this.getAndProvideContext({
      type: reference.type,
      chainId: this.args.chainId,
      address,
    });
  }

  /**
   * This method will provide the enum context reference to the device
   * if the enum value is found in the transaction enums mapping.
   *
   * Note: We do not need to call the context module to get the enum context
   * as it is already provided with transactionEnums mapping.
   *
   * @param {ClearSignContextReference<ClearSignContextType.ENUM>} reference The enum reference to provide.
   * @param {Uint8Array} value The value of the enum.
   * @returns A promise that resolves when the context is provided.
   */
  private async provideEnumContextReference(
    reference: ClearSignContextReference<ClearSignContextType.ENUM>,
    value: Uint8Array,
  ): Promise<
    Maybe<CommandErrorResult<ProvideTransactionGenericContextTaskErrorCodes>>
  > {
    const enumValue = value[value.length - 1];
    if (!enumValue) return Nothing;

    const enumDescriptor = this.args.transactionEnums.find(
      (enumContext) =>
        enumContext.value === enumValue && enumContext.id === reference.id,
    );
    if (enumDescriptor) {
      await this.loadCertificate(enumDescriptor.certificate);

      const provideEnumResult = await this.provideContext(enumDescriptor);
      if (!isSuccessCommandResult(provideEnumResult)) {
        return Just(provideEnumResult);
      }
    }
    return Nothing;
  }

  /**
   * This method will provide the trusted name context reference to the device.
   *
   * Note: We need to call the context module to get the trusted name context
   * with a challenge to ensure the trusted name is valid.
   *
   * @param {ClearSignContextReference<ClearSignContextType.TRUSTED_NAME>} reference The trusted name reference to provide.
   * @param {HexaString} address The address of the trusted name.
   * @returns A promise that resolves when the context is provided.
   */
  private async provideTustedNameContextReference(
    reference: ClearSignContextReference<ClearSignContextType.TRUSTED_NAME>,
    address: HexaString,
  ): Promise<
    Maybe<
      CommandErrorResult<
        ProvideTransactionGenericContextTaskErrorCodes | EthErrorCodes
      >
    >
  > {
    const getChallengeResult = await this.api.sendCommand(
      new GetChallengeCommand(),
    );
    if (!isSuccessCommandResult(getChallengeResult)) {
      return Just(getChallengeResult);
    }

    return this.getAndProvideContext({
      type: reference.type,
      chainId: this.args.chainId,
      address,
      challenge: getChallengeResult.data.challenge,
      types: reference.types,
      sources: reference.sources,
    });
  }

  /**
   * This method will get the context from the context module
   * and provide it to the device.
   *
   * @param {TransactionFieldContext} field The field to provide.
   * @returns A promise that resolves when the context is provided.
   */
  private async getAndProvideContext(
    field: TransactionFieldContext,
  ): Promise<
    Maybe<CommandErrorResult<ProvideTransactionGenericContextTaskErrorCodes>>
  > {
    const context = await this.args.contextModule.getContext(field);
    if (context.type !== ClearSignContextType.ERROR) {
      const provideReferenceResult = await this.provideContext(context);
      if (!isSuccessCommandResult(provideReferenceResult)) {
        return Just(provideReferenceResult);
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
  private async provideContext({
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
        return new SendPayloadInChunksTask(this.api, {
          payload,
          commandFactory: (args) =>
            new ProvideTrustedNameCommand({
              data: args.chunkedData,
              isFirstChunk: args.isFirstChunk,
            }),
        }).run();
      case ClearSignContextType.ENUM:
        return new SendPayloadInChunksTask(this.api, {
          payload,
          commandFactory: (args) =>
            new ProvideEnumCommand({
              data: args.chunkedData,
              isFirstChunk: args.isFirstChunk,
            }),
        }).run();
      case ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION:
        return new SendPayloadInChunksTask(this.api, {
          payload,
          commandFactory: (args) =>
            new ProvideTransactionFieldDescriptionCommand({
              data: args.chunkedData,
              isFirstChunk: args.isFirstChunk,
            }),
        }).run();
      case ClearSignContextType.TRANSACTION_INFO:
      case ClearSignContextType.PLUGIN:
      case ClearSignContextType.EXTERNAL_PLUGIN:
      case ClearSignContextType.DYNAMIC_NETWORK:
        return CommandResultFactory({
          error: new InvalidStatusWordError(
            `The context type [${type}] is not valid as a transaction field or metadata`,
          ),
        });
      case ClearSignContextType.WEB3_CHECK:
        return new SendPayloadInChunksTask(this.api, {
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
