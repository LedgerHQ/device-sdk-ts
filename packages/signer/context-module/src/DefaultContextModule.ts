import { type Container } from "inversify";

import type { TypedDataClearSignContext } from "@/shared/model/TypedDataClearSignContext";
import type { TypedDataContext } from "@/shared/model/TypedDataContext";
import { transactionTypes } from "@/transaction/di/transactionTypes";

import { type ContextModuleConfig } from "./config/model/ContextModuleConfig";
import { externalPluginTypes } from "./external-plugin/di/externalPluginTypes";
import { type ExternalPluginContextLoader } from "./external-plugin/domain/ExternalPluginContextLoader";
import { forwardDomainTypes } from "./forward-domain/di/forwardDomainTypes";
import { type ForwardDomainContextLoader } from "./forward-domain/domain/ForwardDomainContextLoader";
import { nftTypes } from "./nft/di/nftTypes";
import { type NftContextLoader } from "./nft/domain/NftContextLoader";
import { type ContextLoader } from "./shared/domain/ContextLoader";
import { type ClearSignContext } from "./shared/model/ClearSignContext";
import { type TransactionContext } from "./shared/model/TransactionContext";
import { tokenTypes } from "./token/di/tokenTypes";
import { type TokenContextLoader } from "./token/domain/TokenContextLoader";
import { type TransactionContextLoader } from "./transaction/domain/TransactionContextLoader";
import { typedDataTypes } from "./typed-data/di/typedDataTypes";
import type { TypedDataContextLoader } from "./typed-data/domain/TypedDataContextLoader";
import { type ContextModule } from "./ContextModule";
import { makeContainer } from "./di";

export class DefaultContextModule implements ContextModule {
  private _container: Container;
  private _loaders: ContextLoader[];
  private _typedDataLoader: TypedDataContextLoader;

  constructor(args: ContextModuleConfig) {
    this._container = makeContainer({ config: args });
    this._loaders = args.defaultLoaders ? this._getDefaultLoaders() : [];
    this._loaders.push(...args.customLoaders);
    this._typedDataLoader =
      args.customTypedDataLoader ?? this._getDefaultTypedDataLoader();
  }

  private _getDefaultLoaders(): ContextLoader[] {
    return [
      this._container.get<ExternalPluginContextLoader>(
        externalPluginTypes.ExternalPluginContextLoader,
      ),
      this._container.get<ForwardDomainContextLoader>(
        forwardDomainTypes.ForwardDomainContextLoader,
      ),
      this._container.get<NftContextLoader>(nftTypes.NftContextLoader),
      this._container.get<TokenContextLoader>(tokenTypes.TokenContextLoader),
      this._container.get<TransactionContextLoader>(
        transactionTypes.TransactionContextLoader,
      ),
    ];
  }

  private _getDefaultTypedDataLoader(): TypedDataContextLoader {
    return this._container.get<TypedDataContextLoader>(
      typedDataTypes.TypedDataContextLoader,
    );
  }

  public async getContexts(
    transaction: TransactionContext,
  ): Promise<ClearSignContext[]> {
    const promises = this._loaders.map((fetcher) => fetcher.load(transaction));
    const responses = await Promise.all(promises);
    return responses.flat();
  }

  public async getTypedDataFilters(
    typedData: TypedDataContext,
  ): Promise<TypedDataClearSignContext> {
    return this._typedDataLoader.load(typedData);
  }
}
