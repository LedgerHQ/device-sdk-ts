import {
  type ClearSignContext,
  type ClearSignContextReference,
  ClearSignContextReferenceType,
  type ClearSignContextSuccess,
  ClearSignContextType,
  type ContextModule,
  type TransactionFieldContext,
  type TransactionSubset,
} from "@ledgerhq/context-module";
import {
  bufferToHexaString,
  type InternalApi,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { GetChallengeCommand } from "@internal/app-binder/command/GetChallengeCommand";
import { type TransactionParserService } from "@internal/transaction/service/parser/TransactionParserService";

export type BuildSubcontextsTaskArgs = {
  readonly context: ClearSignContextSuccess;
  readonly contextOptional: ClearSignContextSuccess[];
  readonly transactionParser: TransactionParserService;
  readonly subset: TransactionSubset;
  readonly contextModule: ContextModule;
};

export type BuildSubcontextsTaskResult = {
  subcontextCallbacks: (() => Promise<ClearSignContext>)[];
};

export class BuildSubcontextsTask {
  constructor(
    private readonly api: InternalApi,
    private readonly args: BuildSubcontextsTaskArgs,
  ) {}

  run(): BuildSubcontextsTaskResult {
    const context = this.args.context;

    if (context.type !== ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION) {
      return {
        subcontextCallbacks: [],
      };
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
        type:
          context.reference.type === ClearSignContextReferenceType.TOKEN
            ? ClearSignContextType.TOKEN
            : ClearSignContextType.NFT,
        chainId: this.args.subset.chainId,
        address: context.reference.value,
      };

      return {
        subcontextCallbacks: [
          () => this.args.contextModule.getContext(transactionFieldContext),
        ],
      };
    }

    // if the reference is a path, it means we need to extract the value
    // from the transaction and provide it to the device
    if (
      context.reference !== undefined &&
      context.reference.valuePath !== undefined
    ) {
      // iterate on each reference and provide the context
      const referenceValues = this.args.transactionParser.extractValue(
        this.args.subset,
        context.reference.valuePath,
      );

      if (referenceValues.isRight()) {
        const subcontextCallbacks: (() => Promise<ClearSignContext>)[] = [];

        for (const value of referenceValues.extract()) {
          if (context.reference.type === ClearSignContextReferenceType.ENUM) {
            const reference: ClearSignContextReference<ClearSignContextReferenceType.ENUM> =
              context.reference;
            const enumValue = value[value.length - 1];
            if (enumValue === undefined) {
              continue;
            }

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
            context.reference.type === ClearSignContextReferenceType.TOKEN ||
            context.reference.type === ClearSignContextReferenceType.NFT
          ) {
            const reference: ClearSignContextReference<
              | ClearSignContextReferenceType.TOKEN
              | ClearSignContextReferenceType.NFT
            > = context.reference;
            const address = bufferToHexaString(
              value.slice(Math.max(0, value.length - 20)),
            );

            subcontextCallbacks.push(() =>
              this.args.contextModule.getContext({
                type:
                  reference.type === ClearSignContextReferenceType.TOKEN
                    ? ClearSignContextType.TOKEN
                    : ClearSignContextType.NFT,
                chainId: this.args.subset.chainId,
                address,
              }),
            );
          }

          if (
            context.reference.type ===
            ClearSignContextReferenceType.TRUSTED_NAME
          ) {
            const reference: ClearSignContextReference<ClearSignContextReferenceType.TRUSTED_NAME> =
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
                type: ClearSignContextType.TRUSTED_NAME,
                chainId: this.args.subset.chainId,
                address,
                challenge: getChallengeResult.data.challenge,
                types: reference.types,
                sources: reference.sources,
              });

              return subcontext;
            });
          }
        }

        return {
          subcontextCallbacks,
        };
      }
    }

    return {
      subcontextCallbacks: [],
    };
  }
}
