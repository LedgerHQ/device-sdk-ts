import type { TypedDataClearSignContext } from "@/shared/model/TypedDataClearSignContext";
import type { TypedDataContext } from "@/shared/model/TypedDataContext";

import { type ContextLoader } from "./shared/domain/ContextLoader";
import { type ClearSignContext } from "./shared/model/ClearSignContext";
import { type TransactionContext } from "./shared/model/TransactionContext";
import type { TypedDataContextLoader } from "./typed-data/domain/TypedDataContextLoader";
import { type ContextModule } from "./ContextModule";

type DefaultContextModuleConstructorArgs = {
  loaders: ContextLoader[];
  typedDataLoader: TypedDataContextLoader;
};

export class DefaultContextModule implements ContextModule {
  private _loaders: ContextLoader[];
  private _typedDataLoader: TypedDataContextLoader;

  constructor(args: DefaultContextModuleConstructorArgs) {
    this._loaders = args.loaders;
    this._typedDataLoader = args.typedDataLoader;
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
