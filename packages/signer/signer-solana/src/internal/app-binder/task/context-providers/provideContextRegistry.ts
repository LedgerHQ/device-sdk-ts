import {
  ClearSignContextType,
  type SolanaContextSuccess,
  type SolanaContextSuccessType,
} from "@ledgerhq/context-module";

import {
  type ProvideContextDeps,
  type ProvideContextHandler,
} from "./provideContextTypes";
import { provideLifiContext } from "./provideLifiContext";
import { provideTokenContext } from "./provideTokenContext";
import { provideTransactionCheckContext } from "./provideTransactionCheckContext";

/**
 * Per-type provide pipeline: maps each success context type to its device-provision handler.
 * Adding a new {@link SolanaContextSuccessType} without a handler here is a compile error.
 */
const PROVIDE_CONTEXT_REGISTRY: {
  [K in SolanaContextSuccessType]: ProvideContextHandler<K>;
} = {
  [ClearSignContextType.SOLANA_TOKEN]: provideTokenContext,
  [ClearSignContextType.SOLANA_LIFI]: provideLifiContext,
  [ClearSignContextType.SOLANA_TRANSACTION_CHECK]:
    provideTransactionCheckContext,
};

type DiscriminatedSolanaContextSuccess = {
  [K in SolanaContextSuccessType]: SolanaContextSuccess<K>;
}[SolanaContextSuccessType];

export function dispatchProvideContext(
  result: DiscriminatedSolanaContextSuccess,
  deps: ProvideContextDeps,
): Promise<void> {
  const handler = PROVIDE_CONTEXT_REGISTRY[result.type] as (
    result: DiscriminatedSolanaContextSuccess,
    deps: ProvideContextDeps,
  ) => Promise<void>;
  return handler(result, deps);
}
