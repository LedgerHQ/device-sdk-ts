import { type Container } from "inversify";
import { Left } from "purify-ts";

import { calldataTypes } from "@/calldata/di/calldataTypes";
import { dynamicNetworkTypes } from "@/dynamic-network/di/dynamicNetworkTypes";
import type { TypedDataClearSignContext } from "@/shared/model/TypedDataClearSignContext";
import type { TypedDataContext } from "@/shared/model/TypedDataContext";
import { trustedNameTypes } from "@/trusted-name/di/trustedNameTypes";

import { type ContextModuleConfig } from "./config/model/ContextModuleConfig";
import { externalPluginTypes } from "./external-plugin/di/externalPluginTypes";
import { nftTypes } from "./nft/di/nftTypes";
import { proxyTypes } from "./proxy/di/proxyTypes";
import { safeTypes } from "./safe/di/safeTypes";
import { type ContextFieldLoader } from "./shared/domain/ContextFieldLoader";
import { type ContextLoader } from "./shared/domain/ContextLoader";
import {
  type ClearSignContext,
  type ClearSignContextSuccess,
  ClearSignContextType,
} from "./shared/model/ClearSignContext";
import { type SolanaTransactionContext } from "./shared/model/SolanaTransactionContext";
import { solanaContextTypes } from "./solana/di/solanaContextTypes";
import { type SolanaContextLoader } from "./solana/domain/SolanaContextLoader";
import { type SolanaTransactionContextResult } from "./solana/domain/solanaContextTypes";
import { tokenTypes } from "./token/di/tokenTypes";
import { typedDataTypes } from "./typed-data/di/typedDataTypes";
import type { TypedDataContextLoader } from "./typed-data/domain/TypedDataContextLoader";
import { web3CheckTypes } from "./web3-check/di/web3CheckTypes";
import { type Web3CheckContextLoader } from "./web3-check/domain/Web3CheckContextLoader";
import {
  type Web3CheckContext,
  type Web3Checks,
} from "./web3-check/domain/web3CheckTypes";
import { type ContextModule } from "./ContextModule";
import { makeContainer } from "./di";

export class DefaultContextModule implements ContextModule {
  private _container: Container;
  private _loaders: ContextLoader<unknown>[];
  private _typedDataLoader: TypedDataContextLoader;
  private _web3CheckLoader: Web3CheckContextLoader;
  private _solanaLoader: SolanaContextLoader;
  private _fieldLoaders: ContextFieldLoader<unknown>[];

  constructor(args: ContextModuleConfig) {
    this._container = makeContainer({ config: args });

    this._loaders = args.defaultLoaders ? this._getDefaultLoaders() : [];
    this._loaders.push(...args.customLoaders);

    this._fieldLoaders = args.defaultFieldLoaders
      ? this._getDefaultFieldLoaders()
      : [];
    this._fieldLoaders.push(...args.customFieldLoaders);

    this._typedDataLoader =
      args.customTypedDataLoader ?? this._getDefaultTypedDataLoader();
    this._web3CheckLoader =
      args.customWeb3CheckLoader ?? this._getWeb3CheckLoader();
    this._solanaLoader = args.customSolanaLoader ?? this._getSolanaLoader();
  }

  private _getDefaultFieldLoaders(): ContextFieldLoader[] {
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
    return [
      this._container.get<ContextLoader>(
        externalPluginTypes.ExternalPluginContextLoader,
      ),
      this._container.get<ContextLoader>(
        trustedNameTypes.TrustedNameContextLoader,
      ),
      this._container.get<ContextLoader>(nftTypes.NftContextLoader),
      this._container.get<ContextLoader>(tokenTypes.TokenContextLoader),
      this._container.get<ContextLoader>(calldataTypes.CalldataContextLoader),
      this._container.get<ContextLoader>(
        dynamicNetworkTypes.DynamicNetworkContextLoader,
      ),
      this._container.get<ContextLoader>(safeTypes.SafeAccountLoader),
    ];
  }

  private _getDefaultTypedDataLoader(): TypedDataContextLoader {
    return this._container.get<TypedDataContextLoader>(
      typedDataTypes.TypedDataContextLoader,
    );
  }

  private _getWeb3CheckLoader(): Web3CheckContextLoader {
    return this._container.get<Web3CheckContextLoader>(
      web3CheckTypes.Web3CheckContextLoader,
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

  public async getWeb3Checks(
    transactionContext: Web3CheckContext,
  ): Promise<ClearSignContextSuccess<ClearSignContextType.WEB3_CHECK> | null> {
    const web3Checks = await this._web3CheckLoader.load(transactionContext);

    return web3Checks.caseOf({
      Right: (checks: Web3Checks) => ({
        type: ClearSignContextType.WEB3_CHECK,
        payload: checks.descriptor,
        certificate: checks.certificate,
      }),
      Left: () => null,
    });
  }

  public async getSolanaContext(
    transactionContext: SolanaTransactionContext,
  ): Promise<SolanaTransactionContextResult> {
    return await this._solanaLoader.load(transactionContext);
  }
}
