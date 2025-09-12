import { type Container } from "inversify";
import { Left } from "purify-ts";

import type { TypedDataClearSignContext } from "@/shared/model/TypedDataClearSignContext";
import type { TypedDataContext } from "@/shared/model/TypedDataContext";
import { transactionTypes } from "@/transaction/di/transactionTypes";
import { trustedNameTypes } from "@/trusted-name/di/trustedNameTypes";

import { type ContextModuleConfig } from "./config/model/ContextModuleConfig";
import { externalPluginTypes } from "./external-plugin/di/externalPluginTypes";
import { type ExternalPluginContextLoader } from "./external-plugin/domain/ExternalPluginContextLoader";
import { nftTypes } from "./nft/di/nftTypes";
import { type NftContextLoader } from "./nft/domain/NftContextLoader";
import { type ContextLoader } from "./shared/domain/ContextLoader";
import {
  type ClearSignContext,
  type ClearSignContextSuccess,
  ClearSignContextType,
} from "./shared/model/ClearSignContext";
import { type SolanaTransactionContext } from "./shared/model/SolanaTransactionContext";
import {
  type TransactionContext,
  type TransactionFieldContext,
} from "./shared/model/TransactionContext";
import { solanaContextTypes } from "./solana/di/solanaContextTypes";
import { type SolanaContextLoader } from "./solana/domain/SolanaContextLoader";
import { type SolanaTransactionContextResult } from "./solana/domain/solanaContextTypes";
import { tokenTypes } from "./token/di/tokenTypes";
import { type TokenContextLoader } from "./token/domain/TokenContextLoader";
import { type TransactionContextLoader } from "./transaction/domain/TransactionContextLoader";
import { type TrustedNameContextLoader } from "./trusted-name/domain/TrustedNameContextLoader";
import { typedDataTypes } from "./typed-data/di/typedDataTypes";
import type { TypedDataContextLoader } from "./typed-data/domain/TypedDataContextLoader";
import { uniswapTypes } from "./uniswap/di/uniswapTypes";
import { type UniswapContextLoader } from "./uniswap/domain/UniswapContextLoader";
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
  private _loaders: ContextLoader[];
  private _typedDataLoader: TypedDataContextLoader;
  private _web3CheckLoader: Web3CheckContextLoader;
  private _solanaLoader: SolanaContextLoader;

  constructor(args: ContextModuleConfig) {
    this._container = makeContainer({ config: args });
    this._loaders = args.defaultLoaders ? this._getDefaultLoaders() : [];
    this._loaders.push(...args.customLoaders);
    this._typedDataLoader =
      args.customTypedDataLoader ?? this._getDefaultTypedDataLoader();
    this._web3CheckLoader =
      args.customWeb3CheckLoader ?? this._getWeb3CheckLoader();
    this._solanaLoader = args.customSolanaLoader ?? this._getSolanaLoader();
  }

  private _getDefaultLoaders(): ContextLoader[] {
    return [
      this._container.get<ExternalPluginContextLoader>(
        externalPluginTypes.ExternalPluginContextLoader,
      ),
      this._container.get<TrustedNameContextLoader>(
        trustedNameTypes.TrustedNameContextLoader,
      ),
      this._container.get<NftContextLoader>(nftTypes.NftContextLoader),
      this._container.get<TokenContextLoader>(tokenTypes.TokenContextLoader),
      this._container.get<TransactionContextLoader>(
        transactionTypes.TransactionContextLoader,
      ),
      this._container.get<UniswapContextLoader>(
        uniswapTypes.UniswapContextLoader,
      ),
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
    transaction: TransactionContext,
  ): Promise<ClearSignContext[]> {
    const promises = this._loaders.map((fetcher) => fetcher.load(transaction));
    const responses = await Promise.all(promises);
    return responses.flat();
  }

  public async getContext(
    field: TransactionFieldContext,
  ): Promise<ClearSignContext> {
    const promises = this._loaders
      .filter((fetcher) => fetcher.loadField)
      .map((fetcher) => fetcher.loadField!(field));
    const responses = await Promise.all(promises);
    return (
      responses.find((resp) => resp !== null) || {
        type: ClearSignContextType.ERROR,
        error: new Error(`Field type not supported: ${field.type}`),
      }
    );
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
