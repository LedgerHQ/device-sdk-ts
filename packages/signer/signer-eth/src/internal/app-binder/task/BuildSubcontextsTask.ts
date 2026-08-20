import {
  type ClearSignContext,
  type ClearSignContextReference,
  ClearSignContextReferenceType,
  type ClearSignContextSuccess,
  ClearSignContextType,
  type ContextModule,
  type EthereumClearSignContextSuccess,
  type TransactionSubset,
} from "@ledgerhq/context-module";
import {
  bufferToHexaString,
  type DeviceModelId,
  type InternalApi,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { GetChallengeCommand } from "@internal/app-binder/command/GetChallengeCommand";
import { type TransactionParserService } from "@internal/transaction/service/parser/TransactionParserService";

export type BuildSubcontextsTaskArgs = {
  readonly context: EthereumClearSignContextSuccess;
  readonly contextOptional: EthereumClearSignContextSuccess[];
  readonly transactionParser: TransactionParserService;
  readonly subset: TransactionSubset;
  readonly deviceModelId: DeviceModelId;
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
      case ClearSignContextType.ETHEREUM_TRANSACTION_CHECK:
      case ClearSignContextType.ETHEREUM_TRANSACTION_INFO:
      case ClearSignContextType.ETHEREUM_PLUGIN:
      case ClearSignContextType.ETHEREUM_EXTERNAL_PLUGIN:
      case ClearSignContextType.ETHEREUM_DYNAMIC_NETWORK:
      case ClearSignContextType.ETHEREUM_DYNAMIC_NETWORK_ICON:
      case ClearSignContextType.ETHEREUM_ENUM:
      case ClearSignContextType.ETHEREUM_TOKEN:
      case ClearSignContextType.ETHEREUM_NFT:
      case ClearSignContextType.ETHEREUM_SAFE:
      case ClearSignContextType.ETHEREUM_SIGNER:
      case ClearSignContextType.ETHEREUM_GATED_SIGNING:
      case ClearSignContextType.ETHEREUM_CONTACT_EXTERNAL:
      case ClearSignContextType.ETHEREUM_CONTACT_LEDGER_ACCOUNT:
        return {
          subcontextCallbacks: [],
        };
      case ClearSignContextType.ETHEREUM_TRANSACTION_FIELD_DESCRIPTION:
        return {
          subcontextCallbacks: context.reference
            ? this._getSubcontextsFromReference(context.reference)
            : [],
        };
      case ClearSignContextType.ETHEREUM_PROXY_INFO:
        return {
          subcontextCallbacks: this._getSubcontextFromProxy(context),
        };
      case ClearSignContextType.ETHEREUM_TRUSTED_NAME:
        return {
          subcontextCallbacks: this._getSubcontextFromTrustedName(context),
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
        // calldata reference is handled by the BuildFullContextsTask and ParseNestedTransactionTask
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
      const transactionFieldContext = {
        chainId: this.args.subset.chainId,
        address: reference.value,
        deviceModelId: this.args.deviceModelId,
      };

      const expectedType =
        reference.type === ClearSignContextReferenceType.TOKEN
          ? ClearSignContextType.ETHEREUM_TOKEN
          : ClearSignContextType.ETHEREUM_NFT;

      return [
        () =>
          this.args.contextModule.getFieldContext(
            transactionFieldContext,
            expectedType,
          ),
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

        const expectedType =
          reference.type === ClearSignContextReferenceType.TOKEN
            ? ClearSignContextType.ETHEREUM_TOKEN
            : ClearSignContextType.ETHEREUM_NFT;

        subcontextCallbacks.push(() =>
          this.args.contextModule.getFieldContext(
            {
              chainId: this.args.subset.chainId,
              address,
              deviceModelId: this.args.deviceModelId,
            },
            expectedType,
          ),
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
        (c) => c.type === ClearSignContextType.ETHEREUM_ENUM,
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
            return {
              type: ClearSignContextType.ERROR,
              error: new Error("Failed to get challenge"),
            };
          }

          const subcontext = await this.args.contextModule.getFieldContext(
            {
              chainId: this.args.subset.chainId,
              address,
              challenge: getChallengeResult.data.challenge,
              types: reference.types,
              sources: reference.sources,
              deviceModelId: this.args.deviceModelId,
            },
            ClearSignContextType.ETHEREUM_TRUSTED_NAME,
          );

          return subcontext;
        });
      }
    }

    return subcontextCallbacks;
  }

  private _getSubcontextFromTrustedName(
    _context: ClearSignContextSuccess<ClearSignContextType.ETHEREUM_TRUSTED_NAME>,
  ): SubcontextCallback[] {
    return [
      async () => {
        const getChallengeResult = await this.api.sendCommand(
          new GetChallengeCommand(),
        );
        if (!isSuccessCommandResult(getChallengeResult)) {
          return {
            type: ClearSignContextType.ERROR,
            error: new Error("Failed to get challenge"),
          };
        }

        const subcontext = await this.args.contextModule.getFieldContext(
          {
            chainId: this.args.subset.chainId,
            address: this.args.subset.to,
            challenge: getChallengeResult.data.challenge,
            types: ["eoa"],
            sources: ["ens"],
            deviceModelId: this.args.deviceModelId,
          },
          ClearSignContextType.ETHEREUM_TRUSTED_NAME,
        );

        return subcontext;
      },
    ];
  }

  private _getSubcontextFromProxy(
    _context: ClearSignContextSuccess<ClearSignContextType.ETHEREUM_PROXY_INFO>,
  ): SubcontextCallback[] {
    return [
      async () => {
        const getChallengeResult = await this.api.sendCommand(
          new GetChallengeCommand(),
        );
        if (!isSuccessCommandResult(getChallengeResult)) {
          return {
            type: ClearSignContextType.ERROR,
            error: new Error("Failed to get challenge"),
          };
        }

        if (this.args.subset.to === undefined) {
          return {
            type: ClearSignContextType.ERROR,
            error: new Error("Failed to get proxy address"),
          };
        }

        const subcontext = await this.args.contextModule.getFieldContext(
          {
            chainId: this.args.subset.chainId,
            proxyAddress: this.args.subset.to,
            calldata: this.args.subset.data,
            deviceModelId: this.args.deviceModelId,
            challenge: getChallengeResult.data.challenge,
          },
          ClearSignContextType.ETHEREUM_PROXY_INFO,
        );

        return subcontext;
      },
    ];
  }
}
