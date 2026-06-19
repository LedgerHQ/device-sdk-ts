import {
  ClearSignContextType,
  type SolanaContextSuccess,
  type SolanaContextSuccessType,
} from "@ledgerhq/context-module";

import { provideAltResolutionContext } from "./provideAltResolutionContext";
import {
  type ProvideContextDeps,
  type ProvideContextHandler,
} from "./provideContextTypes";
import { provideEnumVariantContext } from "./provideEnumVariantContext";
import { provideInstructionInfoContext } from "./provideInstructionInfoContext";
import { provideLifiContext } from "./provideLifiContext";
import { provideTokenAccountStateContext } from "./provideTokenAccountStateContext";
import { provideTokenContext } from "./provideTokenContext";
import { provideTokenInfoContext } from "./provideTokenInfoContext";
import { provideTransactionCheckContext } from "./provideTransactionCheckContext";
import { provideTrustedNameContext } from "./provideTrustedNameContext";

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
  // Generic clear-signing descriptors
  [ClearSignContextType.SOLANA_INSTRUCTION_INFO]: provideInstructionInfoContext,
  [ClearSignContextType.SOLANA_ENUM_VARIANT]: provideEnumVariantContext,
  [ClearSignContextType.SOLANA_TOKEN_INFO]: provideTokenInfoContext,
  [ClearSignContextType.SOLANA_TOKEN_ACCOUNT_STATE]:
    provideTokenAccountStateContext,
  [ClearSignContextType.SOLANA_ALT_RESOLUTION]: provideAltResolutionContext,
  [ClearSignContextType.SOLANA_TRUSTED_NAME]: provideTrustedNameContext,
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
