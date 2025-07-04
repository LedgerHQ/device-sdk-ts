import {
  type ClearSignContext,
  type ClearSignContextReference,
  type ClearSignContextSuccess,
  ClearSignContextType,
  type ContextModule,
  type TransactionFieldContext,
} from "@ledgerhq/context-module";
import {
  bufferToHexaString,
  type CommandErrorResult,
  type InternalApi,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { type Either, Right } from "purify-ts";

import { GetChallengeCommand } from "@internal/app-binder/command/GetChallengeCommand";
import { type EthErrorCodes } from "@internal/app-binder/command/utils/ethAppErrors";
import { type TransactionParserService } from "@internal/transaction/service/parser/TransactionParserService";

export type BuildSubContextTaskArgs = {
  readonly context: ClearSignContextSuccess;
  readonly contextOptional: ClearSignContextSuccess[];
  readonly transactionParser: TransactionParserService;
  readonly serializedTransaction: Uint8Array;
  readonly contextModule: ContextModule;
  readonly chainId: number;
};

export type BuildSubContextTaskErrorCodes =
  | CommandErrorResult<EthErrorCodes>
  | Error;

export type BuildSubContextTaskResult = {
  context: ClearSignContextSuccess;
  subcontextCallbacks: (() => Promise<ClearSignContext>)[];
};

export class BuildSubContextTask {
  constructor(
    private readonly api: InternalApi,
    private readonly args: BuildSubContextTaskArgs,
  ) {}

  run(): Either<BuildSubContextTaskErrorCodes, BuildSubContextTaskResult> {
    const context = this.args.context;

    if (
      context.type === ClearSignContextType.TRANSACTION_INFO ||
      context.type === ClearSignContextType.ENUM ||
      context.type === ClearSignContextType.WEB3_CHECK ||
      context.type === ClearSignContextType.PLUGIN ||
      context.type === ClearSignContextType.EXTERNAL_PLUGIN ||
      context.type === ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION
    ) {
      return Right({
        context,
        subcontextCallbacks: [],
      });
    }

    // if the reference is a string, it means it is a direct address
    // and we don't need to extract the value from the transaction
    // as it is already provided in the reference
    if (
      context.reference !== undefined &&
      "value" in context.reference &&
      context.reference.value !== undefined
    ) {
      const transactionFieldContext: TransactionFieldContext = {
        type: context.reference.type,
        chainId: this.args.chainId,
        address: context.reference.value,
      };

      return Right({
        context,
        subcontextCallbacks: [
          () => this.args.contextModule.getContext(transactionFieldContext),
        ],
      });
    }

    // if the reference is a path, it means we need to extract the value
    // from the transaction and provide it to the device
    if (
      context.reference !== undefined &&
      context.reference.valuePath !== undefined
    ) {
      // iterate on each reference and provide the context
      const referenceValues = this.args.transactionParser.extractValue(
        this.args.serializedTransaction,
        context.reference.valuePath,
      );

      if (referenceValues.isRight()) {
        const subcontextCallbacks: (() => Promise<ClearSignContext>)[] = [];

        for (const value of referenceValues.extract()) {
          if (context.reference.type === ClearSignContextType.ENUM) {
            const reference: ClearSignContextReference<ClearSignContextType.ENUM> =
              context.reference;
            const enumValue = value[value.length - 1];
            if (!enumValue) continue;

            const enumsContext = this.args.contextOptional.filter(
              (c) => c.type === ClearSignContextType.ENUM,
            );

            const subcontext = enumsContext.find(
              (enumContext) =>
                enumContext.value === enumValue &&
                enumContext.id === reference.id,
            );

            if (subcontext) {
              subcontextCallbacks.push(() => Promise.resolve(subcontext));
            }
          }

          if (
            context.reference.type === ClearSignContextType.TOKEN ||
            context.reference.type === ClearSignContextType.NFT
          ) {
            const reference: ClearSignContextReference<
              ClearSignContextType.TOKEN | ClearSignContextType.NFT
            > = context.reference;
            const address = bufferToHexaString(
              value.slice(Math.max(0, value.length - 20)),
            );

            subcontextCallbacks.push(() =>
              this.args.contextModule.getContext({
                type: reference.type,
                chainId: this.args.chainId,
                address,
              }),
            );
          }

          if (context.reference.type === ClearSignContextType.TRUSTED_NAME) {
            const reference: ClearSignContextReference<ClearSignContextType.TRUSTED_NAME> =
              context.reference;
            subcontextCallbacks.push(async () => {
              const address = bufferToHexaString(
                value.slice(Math.max(0, value.length - 20)),
              );

              const getChallengeResult = await this.api.sendCommand(
                new GetChallengeCommand(),
              );
              if (!isSuccessCommandResult(getChallengeResult)) {
                // TODO: we need to return an error here
                return {
                  type: ClearSignContextType.ERROR,
                  error: new Error("Failed to get challenge"),
                };
              }

              const subcontext = await this.args.contextModule.getContext({
                type: reference.type,
                chainId: this.args.chainId,
                address,
                challenge: getChallengeResult.data.challenge,
                types: reference.types,
                sources: reference.sources,
              });

              return subcontext;
            });
          }
        }

        return Right({
          context,
          subcontextCallbacks,
        });
      }
    }

    return Right({
      context,
      subcontextCallbacks: [],
    });
  }
}
