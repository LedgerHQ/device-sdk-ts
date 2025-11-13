import {
  type ClearSignContext,
  type ClearSignContextType,
} from "@/shared/model/ClearSignContext";

import { type SolanaTransactionContext } from "./shared/model/SolanaTransactionContext";
import { type TypedDataClearSignContext } from "./shared/model/TypedDataClearSignContext";
import { type TypedDataContext } from "./shared/model/TypedDataContext";
import { type SolanaTransactionContextResult } from "./solana/domain/solanaContextTypes";

export interface ContextModule {
  getContexts<TInput>(
    input: TInput,
    expectedTypes?: ClearSignContextType[],
  ): Promise<ClearSignContext[]>;
  getFieldContext<TInput>(
    field: TInput,
    expectedType: ClearSignContextType,
  ): Promise<ClearSignContext>;
  getTypedDataFilters(
    typedData: TypedDataContext,
  ): Promise<TypedDataClearSignContext>;
  getSolanaContext(
    transactionContext: SolanaTransactionContext,
  ): Promise<SolanaTransactionContextResult>;
}
