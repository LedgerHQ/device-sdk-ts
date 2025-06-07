import { type ClearSignContext } from "@/shared/model/ClearSignContext";

import {
  type SolanaTransactionContext,
  type SolanaTransactionContextResult,
} from "./shared/model/SolanaTransactionContext";
import {
  type TransactionContext,
  type TransactionFieldContext,
} from "./shared/model/TransactionContext";
import { type TypedDataClearSignContext } from "./shared/model/TypedDataClearSignContext";
import { type TypedDataContext } from "./shared/model/TypedDataContext";
import { type Web3CheckContext } from "./web3-check/domain/web3CheckTypes";

export interface ContextModule {
  getContext(field: TransactionFieldContext): Promise<ClearSignContext>;
  getContexts(transaction: TransactionContext): Promise<ClearSignContext[]>;
  getTypedDataFilters(
    typedData: TypedDataContext,
  ): Promise<TypedDataClearSignContext>;
  getWeb3Checks(
    transactionContext: Web3CheckContext,
  ): Promise<ClearSignContext | null>;
  getSolanaContext(
    transactionContext: SolanaTransactionContext,
  ): Promise<SolanaTransactionContextResult | null>;
}
