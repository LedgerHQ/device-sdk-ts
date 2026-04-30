import { type Container } from "inversify";
import { Left } from "purify-ts";

import { accountOwnershipTypes } from "@/account-ownership/di/accountOwnershipTypes";
import { calldataTypes } from "@/calldata/di/calldataTypes";
import { dynamicNetworkTypes } from "@/dynamic-network/di/dynamicNetworkTypes";
import { type BlindSigningReportParams } from "@/reporter/data/BlindSigningReporterDatasource";
import { reporterTypes } from "@/reporter/di/reporterTypes";
import { type BlindSigningReporter } from "@/reporter/domain/BlindSigningReporter";
import { ContextModuleChainID } from "@/shared/domain/ContextModuleChainID";
import type { TypedDataClearSignContext } from "@/shared/model/TypedDataClearSignContext";
import type { TypedDataContext } from "@/shared/model/TypedDataContext";
import { ethereumWeb3CheckTypes } from "@/shared/web3-checks/ethereum/di/ethereumWeb3CheckTypes";
import { trustedNameTypes } from "@/trusted-name/di/trustedNameTypes";

import {
  type ContextModuleLoaderConfig,
  type ContextModuleServiceConfig,
} from "./config/model/ContextModuleConfig";
import { externalPluginTypes } from "./external-plugin/di/externalPluginTypes";
import { gatedSigningTypes } from "./gated-signing/di/gatedSigningTypes";
import { nftTypes } from "./nft/di/nftTypes";
import { proxyTypes } from "./proxy/di/proxyTypes";
import { safeTypes } from "./safe/di/safeTypes";
import { type ContextFieldLoader } from "./shared/domain/ContextFieldLoader";
import { type ContextLoader } from "./shared/domain/ContextLoader";
import {
  type ClearSignContext,
  ClearSignContextType,
} from "./shared/model/ClearSignContext";
import { type SolanaTransactionContext } from "./shared/model/SolanaTransactionContext";
import { solanaContextTypes } from "./solana/di/solanaContextTypes";
import { type SolanaContextLoader } from "./solana/domain/SolanaContextLoader";
import { type SolanaTransactionContextResult } from "./solana/domain/solanaContextTypes";
import { tokenTypes } from "./token/di/tokenTypes";
import { typedDataTypes } from "./typed-data/di/typedDataTypes";
import type { TypedDataContextLoader } from "./typed-data/domain/TypedDataContextLoader";
import { type ContextModule } from "./ContextModule";
import { makeContainer } from "./di";

export class DefaultContextModule implements ContextModule {
  private _container: Container;
  private _config: ContextModuleServiceConfig & ContextModuleLoaderConfig;
  private _loaders: ContextLoader<unknown>[];
  private _typedDataLoader: TypedDataContextLoader;
  private _solanaLoader: SolanaContextLoader;
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
    this._solanaLoader = args.customSolanaLoader ?? this._getSolanaLoader();
    this._blindSigningReporter =
      args.customBlindSigningReporter ?? this._getBlindSigningReporter();
  }

  private _getDefaultFieldLoaders(): ContextFieldLoader[] {
    if (this._config.chain !== ContextModuleChainID.Ethereum) return [];
    return [
      this._container.get<ContextFieldLoader>(nftTypes.NftContextFieldLoader),
      this._container.get<ContextFieldLoader>(
        tokenTypes.TokenContextFieldLoader,
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
    return [
      ...(chain === ContextModuleChainID.Ethereum
        ? [
            this._container.get<ContextLoader>(
              accountOwnershipTypes.AccountOwnershipContextLoader,
            ),
            this._container.get<ContextLoader>(
              externalPluginTypes.ExternalPluginContextLoader,
            ),
            this._container.get<ContextLoader>(
              trustedNameTypes.TrustedNameContextLoader,
            ),
            this._container.get<ContextLoader>(nftTypes.NftContextLoader),
            this._container.get<ContextLoader>(tokenTypes.TokenContextLoader),
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
              ethereumWeb3CheckTypes.EthereumWeb3CheckContextLoader,
            ),
            this._container.get<ContextLoader>(
              ethereumWeb3CheckTypes.EthereumTypedDataCheckContextLoader,
            ),
          ]
        : []),
    ];
  }

  private _getDefaultTypedDataLoader(): TypedDataContextLoader {
    if (this._config.chain !== ContextModuleChainID.Ethereum) {
      throw new Error(
        "[ContextModule] getTypedDataFilters is not supported for this chain",
      );
    }
    return this._container.get<TypedDataContextLoader>(
      typedDataTypes.TypedDataContextLoader,
    );
  }

  private _getBlindSigningReporter(): BlindSigningReporter {
    return this._container.get<BlindSigningReporter>(
      reporterTypes.BlindSigningReporter,
    );
  }

  private _getSolanaLoader(): SolanaContextLoader {
    try {
      return this._container.get<SolanaContextLoader>(
        solanaContextTypes.SolanaContextLoader,
      );
    } catch {
      return {
        load: async (_ctx) =>
          Left(
            new Error(
              "[ContextModule] - DefaultContextModule: no SolanaContextLoader bound",
            ),
          ),
      };
    }
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

  public async getSolanaContext(
    transactionContext: SolanaTransactionContext,
  ): Promise<SolanaTransactionContextResult> {
    return await this._solanaLoader.load(transactionContext);
  }

  public async report(params: BlindSigningReportParams): Promise<void> {
    await this._blindSigningReporter.report(params);
  }
}
