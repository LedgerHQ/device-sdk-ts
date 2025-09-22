import {
  type ClearSignContext,
  type ClearSignContextType,
} from "@/shared/model/ClearSignContext";

import { type SolanaTransactionContext } from "./shared/model/SolanaTransactionContext";
import { type TransactionContext } from "./shared/model/TransactionContext";
import { type TypedDataClearSignContext } from "./shared/model/TypedDataClearSignContext";
import { type TypedDataContext } from "./shared/model/TypedDataContext";
import { type SolanaTransactionContextResult } from "./solana/domain/solanaContextTypes";
import { type Web3CheckContext } from "./web3-check/domain/web3CheckTypes";

export interface ContextModule {
  getContexts(ctx: TransactionContext): Promise<ClearSignContext[]>;
  getFieldContext<TInput>(
    field: TInput,
    expectedType: ClearSignContextType,
  ): Promise<ClearSignContext>;
  getTypedDataFilters(
    typedData: TypedDataContext,
  ): Promise<TypedDataClearSignContext>;
  getWeb3Checks(
    transactionContext: Web3CheckContext,
  ): Promise<ClearSignContext | null>;
  getSolanaContext(
    transactionContext: SolanaTransactionContext,
  ): Promise<SolanaTransactionContextResult>;
}
