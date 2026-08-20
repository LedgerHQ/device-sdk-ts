import { type Container } from "inversify";

import {
  type ContextModuleLoaderConfig,
  type ContextModuleServiceConfig,
} from "@/config/model/ContextModuleConfig";
import { type ContextModule } from "@/ContextModule";
import { makeContainer } from "@/di";
import { accountOwnershipTypes } from "@/modules/concordium/account-ownership/di/accountOwnershipTypes";
import { calldataTypes } from "@/modules/ethereum/calldata/di/calldataTypes";
import { contactsTypes } from "@/modules/ethereum/contacts/di/contactsTypes";
import { dynamicNetworkTypes } from "@/modules/ethereum/dynamic-network/di/dynamicNetworkTypes";
import { externalPluginTypes } from "@/modules/ethereum/external-plugin/di/externalPluginTypes";
import { gatedSigningTypes } from "@/modules/ethereum/gated-signing/di/gatedSigningTypes";
import type { TypedDataClearSignContext } from "@/modules/ethereum/model/TypedDataClearSignContext";
import type { TypedDataContext } from "@/modules/ethereum/model/TypedDataContext";
import { nftTypes } from "@/modules/ethereum/nft/di/nftTypes";
import { proxyTypes } from "@/modules/ethereum/proxy/di/proxyTypes";
import { safeTypes } from "@/modules/ethereum/safe/di/safeTypes";
import { tokenTypes as ethereumTokenTypes } from "@/modules/ethereum/token/di/tokenTypes";
import { trustedNameTypes } from "@/modules/ethereum/trusted-name/di/trustedNameTypes";
import { typedDataTypes } from "@/modules/ethereum/typed-data/di/typedDataTypes";
import type { TypedDataContextLoader } from "@/modules/ethereum/typed-data/domain/TypedDataContextLoader";
import { type BlindSigningReportParams } from "@/modules/multichain/reporter/data/BlindSigningReporterDatasource";
import { reporterTypes } from "@/modules/multichain/reporter/di/reporterTypes";
import { type BlindSigningReporter } from "@/modules/multichain/reporter/domain/BlindSigningReporter";
import { transactionCheckTypes } from "@/modules/multichain/transaction-check/di/transactionCheckTypes";
import { altResolutionTypes } from "@/modules/solana/alt-resolution/di/altResolutionTypes";
import { enumVariantTypes } from "@/modules/solana/enum-variant/di/enumVariantTypes";
import { instructionInfoTypes } from "@/modules/solana/instruction-info/di/instructionInfoTypes";
import { lifiTypes } from "@/modules/solana/lifi/di/lifiTypes";
import { ownerInfoTypes } from "@/modules/solana/owner-info/di/ownerInfoTypes";
import { tokenTypes as solanaTokenTypes } from "@/modules/solana/token/di/tokenTypes";
import { tokenAccountStateTypes } from "@/modules/solana/token-account-state/di/tokenAccountStateTypes";
import { tokenInfoTypes } from "@/modules/solana/token-info/di/tokenInfoTypes";
import { solanaTrustedNameTypes } from "@/modules/solana/trusted-name/di/trustedNameTypes";
import { type ContextFieldLoader } from "@/shared/domain/ContextFieldLoader";
import { type ContextLoader } from "@/shared/domain/ContextLoader";
import { ContextModuleChainID } from "@/shared/domain/ContextModuleChainID";
import {
  type ClearSignContext,
  ClearSignContextType,
} from "@/shared/model/ClearSignContext";

export class DefaultContextModule implements ContextModule {
  private _container: Container;
  private _config: ContextModuleServiceConfig & ContextModuleLoaderConfig;
  private _loaders: ContextLoader<unknown>[];
  private _typedDataLoader: TypedDataContextLoader;
  private _fieldLoaders: ContextFieldLoader<unknown>[];
  private _blindSigningReporter: BlindSigningReporter | null;

  constructor(args: ContextModuleServiceConfig & ContextModuleLoaderConfig) {
    this._config = args;
    this._container = makeContainer({ config: args });

    this._loaders = args.defaultLoaders ? this._getDefaultLoaders() : [];
    // Contacts is opt-in (local-first): only registered when the SDK
    // consumer injected a data source. Placed before the default set
    // so it's consulted first; the signer-eth `BuildFullContextsTask`
    // also dedups TRUSTED_NAME entries when CONTACT_* covers the same
    // address (Contacts wins on collision).
    if (args.customContactsDataSource) {
      this._loaders.unshift(
        this._container.get<ContextLoader>(contactsTypes.ContactsContextLoader),
      );
    }
    this._loaders.push(...args.customLoaders);

    this._fieldLoaders = args.defaultFieldLoaders
      ? this._getDefaultFieldLoaders()
      : [];
    this._fieldLoaders.push(...args.customFieldLoaders);

    this._typedDataLoader =
      args.customTypedDataLoader ?? this._getDefaultTypedDataLoader();
    this._blindSigningReporter =
      args.customBlindSigningReporter ?? this._getBlindSigningReporter();
  }

  private _getDefaultFieldLoaders(): ContextFieldLoader[] {
    if (this._config.chain !== ContextModuleChainID.Ethereum) return [];
    return [
      this._container.get<ContextFieldLoader>(nftTypes.NftContextFieldLoader),
      this._container.get<ContextFieldLoader>(
        ethereumTokenTypes.TokenContextFieldLoader,
      ),
      this._container.get<ContextFieldLoader>(
        trustedNameTypes.TrustedNameContextFieldLoader,
      ),
      this._container.get<ContextFieldLoader>(
        proxyTypes.ProxyContextFieldLoader,
      ),
    ];
  }

  private _getDefaultLoaders(): ContextLoader<unknown>[] {
    const { chain } = this._config;
    switch (chain) {
      case ContextModuleChainID.Ethereum:
        return [
          this._container.get<ContextLoader>(
            externalPluginTypes.ExternalPluginContextLoader,
          ),
          this._container.get<ContextLoader>(
            trustedNameTypes.TrustedNameContextLoader,
          ),
          this._container.get<ContextLoader>(nftTypes.NftContextLoader),
          this._container.get<ContextLoader>(
            ethereumTokenTypes.TokenContextLoader,
          ),
          this._container.get<ContextLoader>(
            calldataTypes.CalldataContextLoader,
          ),
          this._container.get<ContextLoader>(
            dynamicNetworkTypes.DynamicNetworkContextLoader,
          ),
          this._container.get<ContextLoader>(safeTypes.SafeAddressLoader),
          this._container.get<ContextLoader>(
            gatedSigningTypes.GatedSigningContextLoader,
          ),
          this._container.get<ContextLoader>(
            gatedSigningTypes.GatedSigningTypedDataContextLoader,
          ),
          this._container.get<ContextLoader>(
            transactionCheckTypes.TransactionCheckLoader,
          ),
          this._container.get<ContextLoader>(
            transactionCheckTypes.TypedDataCheckLoader,
          ),
        ];
      case ContextModuleChainID.Solana:
        return [
          this._container.get<ContextLoader>(
            solanaTokenTypes.TokenContextLoader,
          ),
          this._container.get<ContextLoader>(lifiTypes.LifiContextLoader),
          this._container.get<ContextLoader>(
            ownerInfoTypes.OwnerInfoContextLoader,
          ),
          this._container.get<ContextLoader>(
            transactionCheckTypes.TransactionCheckLoader,
          ),
          this._container.get<ContextLoader>(
            instructionInfoTypes.InstructionInfoContextLoader,
          ),
          this._container.get<ContextLoader>(
            enumVariantTypes.EnumVariantContextLoader,
          ),
          this._container.get<ContextLoader>(
            tokenInfoTypes.TokenInfoContextLoader,
          ),
          this._container.get<ContextLoader>(
            tokenAccountStateTypes.TokenAccountStateContextLoader,
          ),
          this._container.get<ContextLoader>(
            altResolutionTypes.AltResolutionContextLoader,
          ),
          this._container.get<ContextLoader>(
            solanaTrustedNameTypes.SolanaTrustedNameContextLoader,
          ),
        ];
      case ContextModuleChainID.Concordium:
        return [
          this._container.get<ContextLoader>(
            accountOwnershipTypes.AccountOwnershipContextLoader,
          ),
        ];
      default: {
        const exhaustiveCheck: never = chain;
        void exhaustiveCheck;
        return [];
      }
    }
  }

  private _getDefaultTypedDataLoader(): TypedDataContextLoader {
    if (this._config.chain !== ContextModuleChainID.Ethereum) {
      return {
        load: () =>
          Promise.reject(
            new Error(
              "[ContextModule] getTypedDataFilters is not supported for this chain",
            ),
          ),
      };
    }
    return this._container.get<TypedDataContextLoader>(
      typedDataTypes.TypedDataContextLoader,
    );
  }

  private _getBlindSigningReporter(): BlindSigningReporter | null {
    if (this._container.isBound(reporterTypes.BlindSigningReporter)) {
      return this._container.get<BlindSigningReporter>(
        reporterTypes.BlindSigningReporter,
      );
    }
    return null;
  }

  public async getContexts(
    input: unknown,
    expectedTypes?: ClearSignContextType[],
  ): Promise<ClearSignContext[]> {
    const allContextTypes = Object.values(ClearSignContextType);
    const loaders = this._loaders.filter((l) =>
      l.canHandle(input, expectedTypes ?? allContextTypes),
    );
    const promises = loaders.map((fetcher) => fetcher.load(input));
    const responses = await Promise.all(promises);
    return responses.flat();
  }

  public async getFieldContext<TInput>(
    field: TInput,
    expectedType: ClearSignContextType,
  ): Promise<ClearSignContext> {
    const loaders = this._fieldLoaders.filter((l) =>
      l.canHandle(field, expectedType),
    );
    if (loaders.length === 0) {
      return Promise.resolve({
        type: ClearSignContextType.ERROR,
        error: new Error(
          `Loader not found for field: ${field} and expected type: ${expectedType}`,
        ),
      });
    }

    for (const loader of loaders) {
      const context = await loader.loadField(field);
      if (context.type !== ClearSignContextType.ERROR) {
        return context;
      }
    }

    return {
      type: ClearSignContextType.ERROR,
      error: new Error(
        `Loader not found for field: ${field} and expected type: ${expectedType}`,
      ),
    };
  }

  public async getTypedDataFilters(
    typedData: TypedDataContext,
  ): Promise<TypedDataClearSignContext> {
    return this._typedDataLoader.load(typedData);
  }

  public async report(params: BlindSigningReportParams): Promise<void> {
    await this._blindSigningReporter?.report(params);
  }
}
