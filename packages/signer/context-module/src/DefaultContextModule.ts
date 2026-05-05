import { type Container } from "inversify";

import { type BlindSigningReportParams } from "@/chain-agnostic-loaders/reporter/data/BlindSigningReporterDatasource";
import { reporterTypes } from "@/chain-agnostic-loaders/reporter/di/reporterTypes";
import { type BlindSigningReporter } from "@/chain-agnostic-loaders/reporter/domain/BlindSigningReporter";
import { concordiumAccountOwnershipTypes } from "@/concordium-loaders/account-ownership/di/concordiumAccountOwnershipTypes";
import { ethereumCalldataTypes } from "@/ethereum-loaders/calldata/di/ethereumCalldataTypes";
import { ethereumDynamicNetworkTypes } from "@/ethereum-loaders/dynamic-network/di/ethereumDynamicNetworkTypes";
import { ethereumTrustedNameTypes } from "@/ethereum-loaders/trusted-name/di/ethereumTrustedNameTypes";
import { ContextModuleChainID } from "@/shared/domain/ContextModuleChainID";
import type { TypedDataClearSignContext } from "@/shared/model/TypedDataClearSignContext";
import type { TypedDataContext } from "@/shared/model/TypedDataContext";
import { ethereumTransactionWeb3CheckTypes } from "@/shared-loaders/web3-checks/ethereum/di/ethereumWeb3CheckTypes";

import {
  type ContextModuleLoaderConfig,
  type ContextModuleServiceConfig,
} from "./config/model/ContextModuleConfig";
import { ethereumExternalPluginTypes } from "./ethereum-loaders/external-plugin/di/ethereumExternalPluginTypes";
import { ethereumGatedSigningTypes } from "./ethereum-loaders/gated-signing/di/ethereumGatedSigningTypes";
import { ethereumNftTypes } from "./ethereum-loaders/nft/di/ethereumNftTypes";
import { ethereumProxyTypes } from "./ethereum-loaders/proxy/di/ethereumProxyTypes";
import { ethereumSafeTypes } from "./ethereum-loaders/safe/di/ethereumSafeTypes";
import { ethereumTokenTypes } from "./ethereum-loaders/token/di/ethereumTokenTypes";
import { ethereumTypedDataTypes } from "./ethereum-loaders/typed-data/di/ethereumTypedDataTypes";
import type { TypedDataContextLoader } from "./ethereum-loaders/typed-data/domain/TypedDataContextLoader";
import { type ContextFieldLoader } from "./shared/domain/ContextFieldLoader";
import { type ContextLoader } from "./shared/domain/ContextLoader";
import {
  type ClearSignContext,
  ClearSignContextType,
} from "./shared/model/ClearSignContext";
import { solanaLifiTypes } from "./solana-loaders/lifi/di/solanaLifiTypes";
import { solanaContextTypes } from "./solana-loaders/owner-info/di/solanaContextTypes";
import { solanaTokenTypes } from "./solana-loaders/token/di/solanaTokenTypes";
import { type ContextModule } from "./ContextModule";
import { makeContainer } from "./di";

export class DefaultContextModule implements ContextModule {
  private _container: Container;
  private _config: ContextModuleServiceConfig & ContextModuleLoaderConfig;
  private _loaders: ContextLoader<unknown>[];
  private _typedDataLoader: TypedDataContextLoader;
  private _fieldLoaders: ContextFieldLoader<unknown>[];
  private _blindSigningReporter: BlindSigningReporter;

  constructor(args: ContextModuleServiceConfig & ContextModuleLoaderConfig) {
    this._config = args;
    this._container = makeContainer({ config: args });

    this._loaders = args.defaultLoaders ? this._getDefaultLoaders() : [];
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
      this._container.get<ContextFieldLoader>(
        ethereumNftTypes.EthereumNftContextFieldLoader,
      ),
      this._container.get<ContextFieldLoader>(
        ethereumTokenTypes.EthereumTokenContextFieldLoader,
      ),
      this._container.get<ContextFieldLoader>(
        ethereumTrustedNameTypes.EthereumTrustedNameContextFieldLoader,
      ),
      this._container.get<ContextFieldLoader>(
        ethereumProxyTypes.EthereumProxyContextFieldLoader,
      ),
    ];
  }

  private _getDefaultLoaders(): ContextLoader<unknown>[] {
    const { chain } = this._config;
    switch (chain) {
      case ContextModuleChainID.Ethereum:
        return [
          this._container.get<ContextLoader>(
            ethereumExternalPluginTypes.EthereumExternalPluginContextLoader,
          ),
          this._container.get<ContextLoader>(
            ethereumTrustedNameTypes.EthereumTrustedNameContextLoader,
          ),
          this._container.get<ContextLoader>(
            ethereumNftTypes.EthereumNftContextLoader,
          ),
          this._container.get<ContextLoader>(
            ethereumTokenTypes.EthereumTokenContextLoader,
          ),
          this._container.get<ContextLoader>(
            ethereumCalldataTypes.EthereumCalldataContextLoader,
          ),
          this._container.get<ContextLoader>(
            ethereumDynamicNetworkTypes.EthereumDynamicNetworkContextLoader,
          ),
          this._container.get<ContextLoader>(
            ethereumSafeTypes.EthereumSafeAddressLoader,
          ),
          this._container.get<ContextLoader>(
            ethereumGatedSigningTypes.EthereumGatedSigningContextLoader,
          ),
          this._container.get<ContextLoader>(
            ethereumGatedSigningTypes.EthereumGatedSigningTypedDataContextLoader,
          ),
          this._container.get<ContextLoader>(
            ethereumTransactionWeb3CheckTypes.EthereumTransactionWeb3CheckContextLoader,
          ),
          this._container.get<ContextLoader>(
            ethereumTransactionWeb3CheckTypes.EthereumTypedDataWeb3CheckContextLoader,
          ),
        ];
      case ContextModuleChainID.Solana:
        return [
          this._container.get<ContextLoader>(
            solanaTokenTypes.SolanaTokenContextLoader,
          ),
          this._container.get<ContextLoader>(
            solanaLifiTypes.SolanaLifiContextLoader,
          ),
          this._container.get<ContextLoader>(
            solanaContextTypes.SolanaOwnerInfoContextLoader,
          ),
        ];
      case ContextModuleChainID.Concordium:
        return [
          this._container.get<ContextLoader>(
            concordiumAccountOwnershipTypes.ConcordiumAccountOwnershipContextLoader,
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
      ethereumTypedDataTypes.EthereumTypedDataContextLoader,
    );
  }

  private _getBlindSigningReporter(): BlindSigningReporter {
    return this._container.get<BlindSigningReporter>(
      reporterTypes.BlindSigningReporter,
    );
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
    await this._blindSigningReporter.report(params);
  }
}
