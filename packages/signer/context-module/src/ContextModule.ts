import { type ClearSignContext } from "@/shared/model/ClearSignContext";

import {
  type TransactionContext,
  type TransactionFieldContext,
} from "./shared/model/TransactionContext";
import { type TypedDataClearSignContext } from "./shared/model/TypedDataClearSignContext";
import { type TypedDataContext } from "./shared/model/TypedDataContext";

export interface ContextModule {
  getContext(field: TransactionFieldContext): Promise<ClearSignContext>;
  getContexts(transaction: TransactionContext): Promise<ClearSignContext[]>;
  getTypedDataFilters(
    typedData: TypedDataContext,
  ): Promise<TypedDataClearSignContext>;
}
