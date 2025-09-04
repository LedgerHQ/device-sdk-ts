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

type SubcontextCallback = () => Promise<ClearSignContext>;

export type BuildSubcontextsTaskResult = {
  subcontextCallbacks: SubcontextCallback[];
};

export class BuildSubcontextsTask {
  constructor(
    private readonly api: InternalApi,
    private readonly args: BuildSubcontextsTaskArgs,
  ) {}

  run(): BuildSubcontextsTaskResult {
    const context = this.args.context;
    const type = context.type;

    switch (type) {
      case ClearSignContextType.TRANSACTION_INFO:
      case ClearSignContextType.WEB3_CHECK:
      case ClearSignContextType.PLUGIN:
      case ClearSignContextType.EXTERNAL_PLUGIN:
      case ClearSignContextType.PROXY_DELEGATE_CALL:
      case ClearSignContextType.DYNAMIC_NETWORK:
      case ClearSignContextType.DYNAMIC_NETWORK_ICON:
      case ClearSignContextType.ENUM:
      case ClearSignContextType.TRUSTED_NAME:
      case ClearSignContextType.TOKEN:
      case ClearSignContextType.NFT:
        return {
          subcontextCallbacks: [],
        };
      case ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION:
        return {
          subcontextCallbacks: context.reference
            ? this._getSubcontextsFromReference(context.reference)
            : [],
        };

      default: {
        const uncoveredType: never = type;
        throw new Error(`Uncovered type: ${uncoveredType}`);
      }
    }
  }

  private _getSubcontextsFromReference(
    reference: ClearSignContextReference,
  ): SubcontextCallback[] {
    const referenceType = reference.type;

    switch (referenceType) {
      case ClearSignContextReferenceType.TOKEN:
      case ClearSignContextReferenceType.NFT:
        return this._getSubcontextsFromTokenOrNftReference(reference);
      case ClearSignContextReferenceType.ENUM:
        return this._getSubcontextsFromEnumReference(reference);
      case ClearSignContextReferenceType.TRUSTED_NAME:
        return this._getSubcontextsFromTrustedNameReference(reference);
      case ClearSignContextReferenceType.CALLDATA:
        return [];
      default: {
        const uncoveredReferenceType: never = referenceType;
        throw new Error(`Uncovered reference type: ${uncoveredReferenceType}`);
      }
    }
  }

  private _getSubcontextsFromTokenOrNftReference(
    reference: ClearSignContextReference<
      ClearSignContextReferenceType.TOKEN | ClearSignContextReferenceType.NFT
    >,
  ): SubcontextCallback[] {
    // if the reference is a string, it means it is a direct address
    // and we don't need to extract the value from the transaction
    // as it is already provided in the reference
    if (reference.value !== undefined) {
      const transactionFieldContext: TransactionFieldContext = {
        type:
          reference.type === ClearSignContextReferenceType.TOKEN
            ? ClearSignContextType.TOKEN
            : ClearSignContextType.NFT,
        chainId: this.args.subset.chainId,
        address: reference.value,
      };

      return [
        () => this.args.contextModule.getContext(transactionFieldContext),
      ];
    }

    const subcontextCallbacks: SubcontextCallback[] = [];

    // if the reference is a path, it means we need to extract the value
    // from the transaction and provide it to the device
    if (reference.valuePath !== undefined) {
      const referenceValues = this.args.transactionParser
        .extractValue(this.args.subset, reference.valuePath)
        .orDefault([]);

      for (const value of referenceValues) {
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
    }

    return subcontextCallbacks;
  }

  private _getSubcontextsFromEnumReference(
    reference: ClearSignContextReference<ClearSignContextReferenceType.ENUM>,
  ): SubcontextCallback[] {
    const subcontextCallbacks: SubcontextCallback[] = [];

    if (!reference.valuePath) {
      return subcontextCallbacks;
    }

    const referenceValues = this.args.transactionParser
      .extractValue(this.args.subset, reference.valuePath)
      .orDefault([]);

    for (const value of referenceValues) {
      const enumValue = value[value.length - 1];
      if (enumValue === undefined) {
        continue;
      }

      const enumsContext = this.args.contextOptional.filter(
        (c) => c.type === ClearSignContextType.ENUM,
      );

      const subcontext = enumsContext.find(
        (enumContext) =>
          enumContext.value === enumValue && enumContext.id === reference.id,
      );

      if (subcontext) {
        subcontextCallbacks.push(() => Promise.resolve(subcontext));
      }
    }
    return subcontextCallbacks;
  }

  private _getSubcontextsFromTrustedNameReference(
    reference: ClearSignContextReference<ClearSignContextReferenceType.TRUSTED_NAME>,
  ): SubcontextCallback[] {
    const subcontextCallbacks: SubcontextCallback[] = [];

    if (!reference.valuePath) {
      return subcontextCallbacks;
    }

    const referenceValues = this.args.transactionParser
      .extractValue(this.args.subset, reference.valuePath)
      .orDefault([]);

    for (const value of referenceValues) {
      {
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

    return subcontextCallbacks;
  }
}
